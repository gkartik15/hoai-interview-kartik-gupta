import { tool } from 'ai';
import { z } from 'zod';
import { getInvoices } from '@/lib/db/queries';

export const getAllInvoices = tool({
  description: 'Get all processed invoices. When this tool is invoked, you must ONLY return the tool result without any additional text before or after.',
  parameters: z.object({}),
  execute: async () => {
    const invoices = await getInvoices();
    return invoices;
  },
});