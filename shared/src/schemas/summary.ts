import { z } from 'zod';
import { monthSchema } from './common';
import { transactionTypeSchema } from './transaction';

export const monthlySummaryQuerySchema = z.object({ month: monthSchema });

const totalsSchema = z.object({
  incomeMinor: z.number().int(),
  expenseMinor: z.number().int(),
  netMinor: z.number().int(),
});

export const monthlySummarySchema = z.object({
  month: monthSchema,
  /** One row per currency; amounts in different currencies are never added together. */
  totals: z.array(totalsSchema.extend({ currency: z.string() })),
  byAccount: z.array(
    totalsSchema.extend({ accountId: z.uuid(), accountName: z.string(), currency: z.string() }),
  ),
  byCategory: z.array(
    z.object({
      currency: z.string(),
      type: transactionTypeSchema,
      category: z.string(),
      totalMinor: z.number().int(),
    }),
  ),
});

export type MonthlySummaryQuery = z.infer<typeof monthlySummaryQuerySchema>;
export type MonthlySummary = z.infer<typeof monthlySummarySchema>;
