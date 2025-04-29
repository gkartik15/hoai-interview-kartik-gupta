import {
  type Message,
  createDataStreamResponse,
  smoothStream,
  streamText,
} from 'ai';

import { auth } from '@/app/(auth)/auth';
import { myProvider } from '@/lib/ai/models';
import { systemPrompt } from '@/lib/ai/prompts';
import {
  deleteChatById,
  getChatById,
  saveChat,
  saveMessages,
  saveInvoice,
} from '@/lib/db/queries';
import {
  generateUUID,
  getMostRecentUserMessage,
  sanitizeResponseMessages,
} from '@/lib/utils';

import { generateTitleFromUserMessage } from '../../actions';
import { createDocument } from '@/lib/ai/tools/create-document';
import { updateDocument } from '@/lib/ai/tools/update-document';
import { requestSuggestions } from '@/lib/ai/tools/request-suggestions';
import { getWeather } from '@/lib/ai/tools/get-weather';
import { getTextFromDocument } from '@/lib/utils/invoice-parser';

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    
  const body = await request.json();
  let {
    id,
    messages,
    selectedChatModel,
  }: { id: string; messages: Array<Message>; selectedChatModel: string } = body;
  const session = await auth();

  if (!session || !session.user || !session.user.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  const userMessage = getMostRecentUserMessage(messages);

  if (!userMessage) {
    return new Response('No user message found', { status: 400 });
  }

  const chat = await getChatById({ id });

  if (!chat) {
    const title = await generateTitleFromUserMessage({ message: userMessage });
    await saveChat({ id, userId: session.user.id, title });
  }

  // Save user message to database
  await saveMessages({
    messages: [{
      id: userMessage.id,
      chatId: id,
      role: userMessage.role,
      content: userMessage.content,
      createdAt: new Date()
    }],
  });

  const hasAttachments = userMessage.experimental_attachments && userMessage.experimental_attachments.length > 0;
  const isInvoiceRequest = userMessage.content.toLowerCase().includes('invoice') ||
                            userMessage.content.toLowerCase().includes('process document');

  if (hasAttachments && isInvoiceRequest) {
    try {
      for (const attachment of userMessage.experimental_attachments!) {
        // Fetch attachment content
        const attachment = userMessage.experimental_attachments[0];
        const response = await fetch(attachment.url);
        if (!response.ok) {
          throw new Error(`Failed to fetch attachment: ${response.statusText}`);
        }

        const fileData = await response.arrayBuffer();
        const buffer = Buffer.from(fileData);
        const mimeType = attachment.contentType ?? 'application/pdf';

        // Extract text from document
        const extractedText = await getTextFromDocument(buffer, mimeType);

        // Use AI to extract invoice data from document
        messages = [
          {
            id: generateUUID(),
            role: 'system',
            content: `You are an invoice validation expert. Analyze the provided document text and:
              1. Validate if it's a proper invoice (not a receipt or statement)
              2. Extract key information if it's a valid invoice
              3. Return the data in the specified JSON format
      
              Be strict in validation - only accept proper invoices, not receipts or statements.`
              // After extracting and validating the invoice, respond only with a confirmation message like '✅ Invoice processed and saved successfully!' Do not include any JSON, explanations, or extra text.`
          },
          {
            id: generateUUID(),
            role: 'user',
            content: `Analyze this document and return a JSON response with this exact structure:
            {
              "validation": {
                "isValidInvoice": boolean,
                "documentType": string,
                "reason": string
              },
              "data": {
                "customerName": string | null,
                "vendorName": string | null,
                "invoiceNumber": string | null,
                "invoiceDate": string | null,
                "dueDate": string | null,
                "amount": number | null,
                "lineItems": [
                  {
                    "description": string,
                    "quantity": number,
                    "unitPrice": number,
                    "total": number
                  }
                ] | null
              }
            }
      
            Document text:
            ${extractedText}`
        }]
      }
    } catch (error) {
      console.error('Error processing attachment:', error);
    }
  }

  return createDataStreamResponse({
    execute: (dataStream) => {
      const result = streamText({
        model: myProvider.languageModel(selectedChatModel),
        system: systemPrompt({ selectedChatModel }),
        messages,
        maxSteps: 5,
        experimental_activeTools:
          selectedChatModel === 'chat-model-reasoning'
            ? []
            : [
                'getWeather',
                'createDocument',
                'updateDocument',
                'requestSuggestions',
              ],
        experimental_transform: smoothStream({ chunking: 'word' }),
        experimental_generateMessageId: generateUUID,
        tools: {
          getWeather,
          createDocument: createDocument({ session, dataStream }),
          updateDocument: updateDocument({ session, dataStream }),
          requestSuggestions: requestSuggestions({
            session,
            dataStream,
          }),
        },
        onFinish: async ({ response, reasoning }) => {
          if (session.user?.id) {
            try {
              const sanitizedResponseMessages = sanitizeResponseMessages({
                messages: response.messages,
                reasoning,
              });
              if (hasAttachments && isInvoiceRequest) {
                const lastAssistantMessage = sanitizedResponseMessages
                  .filter(msg => msg.role === 'assistant')
                  .pop();
                const contentArr = lastAssistantMessage?.content as Array<{type: string, text: string}>;
                const textBlock = contentArr?.find((c) => c.type === 'text')?.text;
                if (typeof textBlock !== 'string') {
                  throw new Error('No text block found in AI response');
                }
                const cleaned = textBlock.replace(/```json|```/g, '').trim();
                const match = cleaned.match(/\{[\s\S]*\}/);
                if (!match) {
                  throw new Error('No JSON object found in AI response');
                }
                const parsedResponse = JSON.parse(match[0]);

                let confirmationMessage = 'Invoice is not valid, please upload a valid invoice.';
                if (parsedResponse.validation.isValidInvoice) {
                  // Save invoice to database
                  await saveInvoice({
                    chatId: id,
                    messageId: userMessage.id,
                    parsedResponse
                  });
                  // // Build a user-friendly message
                  // const invoice = parsedResponse.data;
                  // const lineItems = invoice.lineItems?.map((item: any) =>
                  //   `• ${item.description} — Qty: ${item.quantity}, Unit Price: $${item.unitPrice.toFixed(2)}, Total: $${item.total.toFixed(2)}`
                  // ).join('\n') || 'No line items found';

                //   const confirmationMessage = `
                // ✅ Invoice processed and saved successfully!

                // 📄 Invoice Details
                // • Invoice Number: ${invoice.invoiceNumber}
                // • Amount: $${invoice.amount?.toFixed(2)}
                // • Customer: ${invoice.customerName}
                // • Vendor: ${invoice.vendorName}
                // • Invoice Date: ${invoice.invoiceDate}
                // • Due Date: ${invoice.dueDate}

                // 📋 Line Items
                // ${lineItems}

                // 🔗 Invoice ID: ${invoice.invoiceId}
                // `;
                  // Save invoice processed confirmation message to database
                  // await saveMessages({
                  //   messages: sanitizedResponseMessages.map((message) => {
                  //     return {
                  //       id: lastAssistantMessage?.id ?? '',
                  //       chatId: id,
                  //       role: 'assistant',
                  //       // content: JSON.stringify({
                  //       //   text: '✅ Invoice processed and saved successfully!',
                  //       //   replyTo: userMessage.id,
                  //       //   invoiceId: parsedResponse.data.invoiceId,
                  //       // }),
                  //       content: confirmationMessage,
                  //       createdAt: new Date(),
                  //     };
                  //   }),
                  // });
                  confirmationMessage = '✅ Invoice processed successfully.';
                } 
                await saveMessages({
                  messages: [{
                    id: generateUUID(),
                    chatId: id,
                    role: 'assistant',
                    content: confirmationMessage,
                    createdAt: new Date(),
                  }],
                });
              } else {
                // Save regular chat assistant message to database
                await saveMessages({
                  messages: sanitizedResponseMessages.map((message) => {
                    return {
                      id: message.id,
                      chatId: id,
                      role: message.role,
                      content: message.content,
                      createdAt: new Date(),
                    };
                  }),
                });
              }
            } catch (error) {
              console.error('Failed to save chat', error);
            }
          }
        },
        experimental_telemetry: {
          isEnabled: true,
          functionId: 'stream-text',
        },
      });

      result.mergeIntoDataStream(dataStream, {
        sendReasoning: true,
      });
    },
    onError: () => {
      return 'Oops, an error occured!';
    },
  });
  } catch (error) {
    console.error('Error in POST handler:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to process request' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return new Response('Not Found', { status: 404 });
  }

  const session = await auth();

  if (!session || !session.user) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const chat = await getChatById({ id });

    await deleteChatById({ id });

    return new Response('Chat deleted', { status: 200 });
  } catch (error) {
    return new Response('An error occurred while processing your request', {
      status: 500,
    });
  }
}
