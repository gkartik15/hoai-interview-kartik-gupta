import {
    type Message,
    createDataStreamResponse,
    generateText,
    smoothStream,
    streamText,
  } from 'ai';
  import { auth } from '@/app/(auth)/auth';
  import { myProvider } from '@/lib/ai/models';
  import { findDuplicateInvoice, saveInvoice, saveMessages } from '@/lib/db/queries';
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
          
            // Check for duplicates first if it's a valid invoice
            if (parsedResponse.validation.isValidInvoice) {
                const duplicate = await findDuplicateInvoice({
                    vendorName: parsedResponse.data.vendorName,
                    invoiceNumber: parsedResponse.data.invoiceNumber,
                    amount: parsedResponse.data.amount
                });
                if (duplicate) {
                    parsedResponse.validation.isDuplicate = true;
                    parsedResponse.validation.existingInvoice = duplicate;
                } else {
                    const invoiceId = await saveInvoice({
                        chatId,
                        messageId: userMessage.id,
                        parsedResponse
                    });
                    parsedResponse.validation.isDuplicate = false;
                    parsedResponse.validation.invoiceId = invoiceId;
                }
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
                        content: `You are an invoice processing assistant. Follow these rules:
                        1. For a valid non duplicate invoice, FIRST you must ALWAYS show the current invoice details in text format with bullet points, NEVER in a table. ONLY AFTER this, ALWAYS invoke getAllInvoices tool and only use tables when showing results from getAllInvoices tool.
                        2. For a valid duplicate invoice, clearly explain the match criteria and show comparison in the exact format provided. Always be helpful and suggest next steps.
                        3. For an invalid invoice, provide reasoning in the exact format provided`
                    },
                    {
                        role: 'user',
                        content: !parsedResponse.validation.isValidInvoice 
                            ? `Display exactly this text and ALWAYS maintain the order of the text and the formatting: 
                            
                            ❌ **Invalid Invoice**\n\n

                            Document type detected: ${parsedResponse.validation.documentType}\n\n
                
                            ${parsedResponse.validation.reason}\n\n
                            
                            Please provide a valid invoice document. The document should:\n
                            • Be a proper invoice (not a receipt or statement)\n
                            • Include vendor and customer information\n
                            • Have a unique invoice number\n
                            • Show clear line items and totals`
                            : parsedResponse.validation.isDuplicate 
                            ? `Display exactly this text and ALWAYS maintain the order of the text and the formatting:
                            
                            ⚠️ **Duplicate Invoice Detected**\n\n

                            This invoice matches an existing entry:\n\n
                            • Vendor: ${parsedResponse.data.vendorName}\n
                            • Invoice #: ${parsedResponse.data.invoiceNumber}\n
                            • Amount: $${parsedResponse.data.amount}\n\n

                            Previously processed on ${new Date(parsedResponse.validation.existingInvoice.createdAt).toLocaleDateString()}\n
                            **Invoice ID**: ${parsedResponse.validation.existingInvoice.id}\n\n

                            Type "Show all invoices" to view the existing invoice details.`
                            : `First, display this exact text about the current invoice with the confirmation text not in a blockquote and ALWAYS maintain the order of the text and the formatting:
                            
                            ✅ **Invoice Processed Successfully**\n\n

                            I've verified this is a unique invoice and saved it to the database.\n\n

                            **Invoice Details:**\n
                            • Vendor: ${parsedResponse.data.vendorName}\n
                            • Customer: ${parsedResponse.data.customerName}\n
                            • Invoice Number: ${parsedResponse.data.invoiceNumber}\n
                            • Date: ${parsedResponse.data.invoiceDate}\n
                            • Due Date: ${parsedResponse.data.dueDate}\n
                            • Amount: $${parsedResponse.data.amount}\n\n
                            
                            **Line Items:**\n
                            ${parsedResponse.data.lineItems?.map((item: any) => 
                            `• ${item.description} [Qty - ${item.quantity}, Units - ${item.unitPrice}, Total - $${item.total}]`
                            ).join('\n\n') || 'No line items found'}
                            
                            Invoice ID: ${parsedResponse.validation.invoiceId}\n\n
                            
                            After, invoke the tool getAllInvoices ONLY and do nothing else. Do not print the details of the all the invoices again. Do not print the tool call. Instead print "Let me show you the updated list of all invoices."`
                    }
                ],
                maxSteps: 5,
                experimental_activeTools: parsedResponse.validation.isValidInvoice && !parsedResponse.validation.isDuplicate
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