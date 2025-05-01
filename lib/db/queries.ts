import 'server-only';
import { and, asc, avg, count, desc, eq, gt, gte, inArray } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';

import {
  chat,
  document,
  type Suggestion,
  suggestion,
  type Message,
  message,
  vote,
  invoice,
  invoiceLineItem,
  tokenUsage,
  TokenUsage,
} from './schema';
import type { BlockKind } from '@/components/block';

// Optionally, if not using email/pass login, you can
// use the Drizzle adapter for Auth.js / NextAuth
// https://authjs.dev/reference/adapter/drizzle

// biome-ignore lint: Forbidden non-null assertion.
const sqlite = new Database('sqlite.db');
const db = drizzle(sqlite);

export async function saveChat({
  id,
  userId,
  title,
}: {
  id: string;
  userId: string;
  title: string;
}) {
  try {
    return await db.insert(chat).values({
      id,
      createdAt: new Date(),
      // userId,
      title,
    });
  } catch (error) {
    console.error('Failed to save chat in database');
    throw error;
  }
}

export async function deleteChatById({ id }: { id: string }) {
  try {
    await db.delete(vote).where(eq(vote.chatId, id));
    await db.delete(message).where(eq(message.chatId, id));

    return await db.delete(chat).where(eq(chat.id, id));
  } catch (error) {
    console.error('Failed to delete chat by id from database');
    throw error;
  }
}

export async function getChatsByUserId({ id }: { id: string }) {
  try {
    return await db
      .select()
      .from(chat)
      // .where(eq(chat.userId, id))
      .orderBy(desc(chat.createdAt));
  } catch (error) {
    console.error('Failed to get chats by user from database');
    throw error;
  }
}

export async function getChatById({ id }: { id: string }) {
  try {
    const [selectedChat] = await db.select().from(chat).where(eq(chat.id, id));
    return selectedChat;
  } catch (error) {
    console.error('Failed to get chat by id from database');
    throw error;
  }
}

export async function saveMessages({ messages }: { messages: Array<Message> }) {
  try {
    return await db.insert(message).values(messages);
  } catch (error) {
    console.error('Failed to save messages in database', error);
    throw error;
  }
}

export async function getMessagesByChatId({ id }: { id: string }) {
  try {
    return await db
      .select()
      .from(message)
      .where(eq(message.chatId, id))
      .orderBy(asc(message.createdAt));
  } catch (error) {
    console.error('Failed to get messages by chat id from database', error);
    throw error;
  }
}

export async function voteMessage({
  chatId,
  messageId,
  type,
}: {
  chatId: string;
  messageId: string;
  type: 'up' | 'down';
}) {
  try {
    const [existingVote] = await db
      .select()
      .from(vote)
      .where(and(eq(vote.messageId, messageId)));

    if (existingVote) {
      return await db
        .update(vote)
        .set({ isUpvoted: type === 'up' })
        .where(and(eq(vote.messageId, messageId), eq(vote.chatId, chatId)));
    }
    return await db.insert(vote).values({
      chatId,
      messageId,
      isUpvoted: type === 'up',
    });
  } catch (error) {
    console.error('Failed to upvote message in database', error);
    throw error;
  }
}

export async function getVotesByChatId({ id }: { id: string }) {
  try {
    return await db.select().from(vote).where(eq(vote.chatId, id));
  } catch (error) {
    console.error('Failed to get votes by chat id from database', error);
    throw error;
  }
}

export async function saveDocument({
  id,
  title,
  kind,
  content,
  userId,
}: {
  id: string;
  title: string;
  kind: BlockKind;
  content: string;
  userId: string;
}) {
  try {
    return await db.insert(document).values({
      id,
      title,
      kind,
      content,
      // userId,
      createdAt: new Date(),
    });
  } catch (error) {
    console.error('Failed to save document in database');
    throw error;
  }
}

export async function getDocumentsById({ id }: { id: string }) {
  try {
    const documents = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(asc(document.createdAt));

    return documents;
  } catch (error) {
    console.error('Failed to get document by id from database');
    throw error;
  }
}

export async function getDocumentById({ id }: { id: string }) {
  try {
    const [selectedDocument] = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(desc(document.createdAt));

    return selectedDocument;
  } catch (error) {
    console.error('Failed to get document by id from database');
    throw error;
  }
}

export async function deleteDocumentsByIdAfterTimestamp({
  id,
  timestamp,
}: {
  id: string;
  timestamp: Date;
}) {
  try {
    await db
      .delete(suggestion)
      .where(
        and(
          eq(suggestion.documentId, id),
          gt(suggestion.documentCreatedAt, timestamp),
        ),
      );

    return await db
      .delete(document)
      .where(and(eq(document.id, id), gt(document.createdAt, timestamp)));
  } catch (error) {
    console.error(
      'Failed to delete documents by id after timestamp from database',
    );
    throw error;
  }
}

export async function saveSuggestions({
  suggestions,
}: {
  suggestions: Array<Suggestion>;
}) {
  try {
    return await db.insert(suggestion).values(suggestions);
  } catch (error) {
    console.error('Failed to save suggestions in database');
    throw error;
  }
}

export async function getSuggestionsByDocumentId({
  documentId,
}: {
  documentId: string;
}) {
  try {
    return await db
      .select()
      .from(suggestion)
      .where(and(eq(suggestion.documentId, documentId)));
  } catch (error) {
    console.error(
      'Failed to get suggestions by document version from database',
    );
    throw error;
  }
}

export async function getMessageById({ id }: { id: string }) {
  try {
    return await db.select().from(message).where(eq(message.id, id));
  } catch (error) {
    console.error('Failed to get message by id from database');
    throw error;
  }
}

export async function deleteMessagesByChatIdAfterTimestamp({
  chatId,
  timestamp,
}: {
  chatId: string;
  timestamp: Date;
}) {
  try {
    const messagesToDelete = await db
      .select({ id: message.id })
      .from(message)
      .where(
        and(eq(message.chatId, chatId), gte(message.createdAt, timestamp)),
      );

    const messageIds = messagesToDelete.map((message) => message.id);

    if (messageIds.length > 0) {
      await db
        .delete(vote)
        .where(
          and(eq(vote.chatId, chatId), inArray(vote.messageId, messageIds)),
        );

      return await db
        .delete(message)
        .where(
          and(eq(message.chatId, chatId), inArray(message.id, messageIds)),
        );
    }
  } catch (error) {
    console.error(
      'Failed to delete messages by id after timestamp from database',
    );
    throw error;
  }
}

export async function updateChatVisiblityById({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: 'private' | 'public';
}) {
  try {
    return await db.update(chat).set({ visibility }).where(eq(chat.id, chatId));
  } catch (error) {
    console.error('Failed to update chat visibility in database');
    throw error;
  }
}

export async function saveInvoice({
  chatId,
  messageId,
  parsedResponse
}: {
  chatId: string;
  messageId: string;
  parsedResponse: any;
}) {
  const invoiceId = crypto.randomUUID();
  await db.insert(invoice).values({
    id: invoiceId,
    chatId: chatId,
    messageId: messageId,
    customerName: parsedResponse.data.customerName,
    vendorName: parsedResponse.data.vendorName,
    invoiceNumber: parsedResponse.data.invoiceNumber,
    invoiceDate: parsedResponse.data.invoiceDate,
    dueDate: parsedResponse.data.dueDate,
    amount: parsedResponse.data.amount,
    createdAt: new Date(),
  });

  if (Array.isArray(parsedResponse.data.lineItems)) {
    for (const item of parsedResponse.data.lineItems) {
      await db.insert(invoiceLineItem).values({
        id: crypto.randomUUID(),
        invoiceId,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.total,
      });
    }
  }
  return invoiceId;
}

export async function getInvoices() {
  try {
    const invoices = await db.select().from(invoice);
    const invoiceIds = invoices.map(inv => inv.id);
    const lineItems = await db.select().from(invoiceLineItem).where(inArray(invoiceLineItem.invoiceId, invoiceIds))
    return invoices.map(inv => ({
      ...inv,
      lineItems: lineItems.filter(item => item.invoiceId === inv.id),
    }));
  } catch (error) {
    console.error('Failed to get invoices from database');
    throw error;
  }
}

export async function getInvoiceById({ id }: { id: string }) {
  try {
    return await db.select().from(invoice).where(eq(invoice.id, id));
  } catch (error) {
    console.error('Failed to get invoice by id from database');
    throw error;
  }
} 

export async function getInvoiceLineItemsByInvoiceId({ id }: { id: string }) {
  try {
    return await db.select().from(invoiceLineItem).where(eq(invoiceLineItem.invoiceId, id));
  } catch (error) {
    console.error('Failed to get invoice line items by invoice id from database');
    throw error;
  }
} 

export async function getInvoiceLineItems() {
  try {
    return await db.select().from(invoiceLineItem);
  } catch (error) {
    console.error('Failed to get invoice line items from database');  
    throw error;
  }
}     

export async function deleteInvoiceLineItemById({ id }: { id: string }) {
  try {
    return await db.delete(invoiceLineItem).where(eq(invoiceLineItem.id, id));
  } catch (error) {
    console.error('Failed to delete invoice line item by id from database');
    throw error;
  }
}   

export async function deleteInvoiceLineItemsByInvoiceId({ invoiceId }: { invoiceId: string }) {
  try {
    return await db.delete(invoiceLineItem).where(eq(invoiceLineItem.invoiceId, invoiceId));
  } catch (error) {
    console.error('Failed to delete invoice line items by invoice id from database'); 
    throw error;
  }
}   

export async function deleteInvoiceById({ id }: { id: string }) {
  try {
    return await db.delete(invoice).where(eq(invoice.id, id));
  } catch (error) {
    console.error('Failed to delete invoice by id from database');
    throw error;
  }
}       

export async function findDuplicateInvoice({
  vendorName,
  invoiceNumber,
  amount
}: {
  vendorName: string;
  invoiceNumber: string;
  amount: number;
}) {
  try {
    const duplicates = await db
      .select()
      .from(invoice)
      .where(
        and(
          eq(invoice.vendorName, vendorName),
          eq(invoice.invoiceNumber, invoiceNumber),
          eq(invoice.amount, amount)
        )
      );
    return duplicates.length > 0 ? duplicates[0] : null;
  } catch (error) {
    console.error('Failed to check for duplicate invoice');
    throw error;
  }
}

export async function saveTokenUsage({
  invoiceId,
  usage
}: {
  invoiceId: string;
  usage: {
    inputTokens: number,
    outputTokens: number,
    totalTokens: number,
    estimatedCost: number
  }
}) {
  try {
    await db.insert(tokenUsage).values({
      id: crypto.randomUUID(),
      invoiceId: invoiceId,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      totalTokens: usage.totalTokens,
      estimatedCost: usage.estimatedCost,
      createdAt: new Date()
    });
  } catch (error) {
    console.error('Failed to save token usage:', error);
    throw error;
  }
}

export async function getAverageTokenUsage() {
  try {
    const result = await db
      .select({
        avgInputTokens: avg(tokenUsage.inputTokens),
        avgOutputTokens: avg(tokenUsage.outputTokens),
        avgTotalTokens: avg(tokenUsage.totalTokens),
        avgCost: avg(tokenUsage.estimatedCost),
        totalInvoices: count(tokenUsage.id)
      })
      .from(tokenUsage);

    return result[0];
  } catch (error) {
    console.error('Failed to get average token usage:', error);
    throw error;
  }
}