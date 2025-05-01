import { tool } from 'ai';
import { z } from 'zod';
import { getAverageTokenUsage } from '@/lib/db/queries';

export const getTokenStats = tool({
  description: 'Get statistics about token usage and costs for invoice processing. When this tool is invoked, you must ONLY return the tool result in text format.',
  parameters: z.object({}),
  execute: async () => {
    const stats = await getAverageTokenUsage();
    return {
      averageInputTokens: Math.round(Number(stats.avgInputTokens ?? 0)),
      averageOutputTokens: Math.round(Number(stats.avgOutputTokens ?? 0)),
      averageTotalTokens: Math.round(Number(stats.avgTotalTokens ?? 0)),
      averageCost: (Number(stats.avgCost ?? 0)).toFixed(4),
      totalInvoices: Number(stats.totalInvoices),
      totalCost: (Number(stats.avgCost ?? 0) * Number(stats.totalInvoices)).toFixed(4)
    };
  },
});