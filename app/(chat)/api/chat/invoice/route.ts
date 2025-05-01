import {
    type Message,
    createDataStreamResponse,
    generateText,
    smoothStream,
    streamText,
  } from 'ai';
  import { auth } from '@/app/(auth)/auth';
  import { myProvider } from '@/lib/ai/models';
  import { saveInvoice, saveMessages } from '@/lib/db/queries';
  import { generateUUID, sanitizeResponseMessages } from '@/lib/utils';
  import { getTextFromDocument } from '@/lib/utils/invoice-parser';
  import { getAllInvoices } from '@/lib/ai/tools/get-invoices';
  
  export async function POST(request: Request) {
    try {
        console.log("Invoice route - Start");
        const body = await request.json();
        const {
            id: chatId,
            messages,
            selectedChatModel,
        }: { id: string; messages: Array<Message>; selectedChatModel: string } = body;
    
        const session = await auth();
        if (!session?.user?.id) {
            return new Response('Unauthorized', { status: 401 });
        }
    
        const userMessage = messages[messages.length - 1];
        const attachment = userMessage.experimental_attachments![0];
        
        // Process attachment
        const attachmentResponse = await fetch(attachment.url);
        if (!attachmentResponse.ok) {
            throw new Error(`Failed to fetch attachment: ${attachmentResponse.statusText}`);
        }
    
        const fileData = await attachmentResponse.arrayBuffer();
        const buffer = Buffer.from(fileData);
        const mimeType = attachment.contentType ?? 'application/pdf';
    
        // Extract text from document
        const extractedText = await getTextFromDocument(buffer, mimeType);
    
        // Use generateText for invoice validation - non-streaming since we need complete result
        const validationResult = await generateText({
            model: myProvider.languageModel(selectedChatModel),
            messages: [
            {
                role: 'system',
                content: `You are an invoice validation expert. Analyze the provided document text and:
                1. Validate if it's a proper invoice (not a receipt or statement)
                2. Extract key information if it's a valid invoice
                3. Return the data in the specified JSON format
    
                Be strict in validation - only accept proper invoices, not receipts or statements.`
            },
            {
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
            }
            ]
        });

        let parsedResponse;
        try {          
            // Extract JSON from the content
            const jsonMatch = validationResult.text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
              throw new Error('No JSON object found in AI response');
            }
          
            parsedResponse = JSON.parse(jsonMatch[0]);
          
            // Save invoice if valid
            if (parsedResponse.validation.isValidInvoice) {
              await saveInvoice({
                chatId,
                messageId: userMessage.id,
                parsedResponse
              });
            }
        } catch (error) {
            console.error('Error in invoice processing:', error);
            return new Response(
                JSON.stringify({ error: 'Failed to process invoice' }),
                { status: 500, headers: { 'Content-Type': 'application/json' } }
            );
        }

      // Return data stream for the chat response using streamText
      return createDataStreamResponse({
        execute: (dataStream) => {
            const result = streamText({
                model: myProvider.languageModel(selectedChatModel),
                messages: [
                    {
                        role: 'system',
                        content: 'You are an invoice processing assistant. You must ALWAYS show the current invoice details in text format with bullet points if it is a valid invoice, NEVER in a table. Only use tables when showing results from getAllInvoices tool.'
                    },
                    {
                        role: 'user',
                        content: parsedResponse.validation.isValidInvoice
                            ? `First, display this exact text about the current invoice:
            
                            ✅ Invoice processed successfully.
                            
                            Invoice Details:
                            • Vendor: ${parsedResponse.data.vendorName}
                            • Customer: ${parsedResponse.data.customerName}
                            • Invoice Number: ${parsedResponse.data.invoiceNumber}
                            • Date: ${parsedResponse.data.invoiceDate}
                            • Due Date: ${parsedResponse.data.dueDate}
                            • Amount: $${parsedResponse.data.amount}
                            
                            Line Items:
                            ${parsedResponse.data.lineItems?.map((item: any) => 
                            `• ${item.description}
                            - Quantity: ${item.quantity}
                            - Unit Price: $${item.unitPrice}
                            - Total: $${item.total}`
                            ).join('\n\n') || 'No line items found'}
                            
                            If there are no saved invoices yet, just say "This is the first invoice being processed. After, invoke the tool getAllInvoices ONLY and do nothing else. Do not print the details of the all the invoices again."`
                            : `Display exactly this text: ❌ Invalid document: ${parsedResponse.validation.reason}`
                    }
                ],
                maxSteps: 5,
                experimental_activeTools: parsedResponse.validation.isValidInvoice 
                    ? ['getAllInvoices']
                    : [],
                experimental_transform: smoothStream({ chunking: 'word' }),
                experimental_generateMessageId: generateUUID,
                tools: {
                    getAllInvoices
                },
                onFinish: async ({ response, reasoning }) => {
                    const sanitizedResponseMessages = sanitizeResponseMessages({
                        messages: response.messages,
                        reasoning
                    });

                    await saveMessages({
                        messages: sanitizedResponseMessages.map(message => ({
                            id: message.id,
                            chatId,
                            role: message.role,
                            content: message.content,
                            createdAt: new Date()
                        }))
                    });
                },
                experimental_telemetry: {
                    isEnabled: true,
                    functionId: 'stream-text',
                },
            });
    
            result.mergeIntoDataStream(dataStream, {
                sendReasoning: true
            });
        },
        onError: () => {
            return 'Oops, an error occurred while processing the invoice!';
        }
      });
    } catch (error) {
        console.error('Error in invoice processing:', error);
        return new Response(
            JSON.stringify({ error: 'Failed to process invoice' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
}