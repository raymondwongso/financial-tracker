import { z } from 'zod';
import { amountMinorSchema, dateSchema, idSchema, monthSchema } from './common';

export const transactionTypes = ['income', 'expense'] as const;
export const transactionTypeSchema = z.enum(transactionTypes);

export const createTransactionSchema = z.object({
  accountId: idSchema,
  type: transactionTypeSchema,
  amountMinor: amountMinorSchema,
  category: z.string().trim().min(1, 'Category is required').max(50),
  description: z.string().trim().max(255).optional(),
  occurredOn: dateSchema,
});

export const transactionSchema = z.object({
  id: z.uuid(),
  accountId: z.uuid(),
  type: transactionTypeSchema,
  amountMinor: z.number().int(),
  category: z.string(),
  description: z.string().nullable(),
  occurredOn: z.string(),
  createdAt: z.string(),
});

/** A transaction plus the account balance right after it (only when listing one account). */
export const transactionWithBalanceSchema = transactionSchema.extend({
  runningBalanceMinor: z.number().int().optional(),
});

export const transactionListSchema = z.array(transactionWithBalanceSchema);

export const listTransactionsQuerySchema = z
  .object({
    accountId: idSchema.optional(),
    month: monthSchema.optional(),
    /** Inclusive date range, `YYYY-MM-DD`. Use either `month` or `from` + `to`. */
    from: dateSchema.optional(),
    to: dateSchema.optional(),
  })
  .refine((q) => !q.month || (!q.from && !q.to), {
    message: 'Use either month or from/to, not both',
    path: ['month'],
  })
  .refine((q) => !!q.from === !!q.to, { message: 'from and to go together', path: ['to'] })
  .refine((q) => !q.from || !q.to || q.from <= q.to, {
    message: 'from must be on or before to',
    path: ['from'],
  });

/** Transactions of one account in an inclusive date range, oldest first, with running balances. */
export const accountStatementSchema = z.object({
  account: z.object({ id: z.uuid(), name: z.string(), type: z.string(), currency: z.string() }),
  from: z.string(),
  to: z.string(),
  openingBalanceMinor: z.number().int(),
  closingBalanceMinor: z.number().int(),
  transactions: z.array(transactionSchema.extend({ runningBalanceMinor: z.number().int() })),
});

export type TransactionType = z.infer<typeof transactionTypeSchema>;
export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type Transaction = z.infer<typeof transactionSchema>;
export type ListTransactionsQuery = z.infer<typeof listTransactionsQuerySchema>;
export type TransactionWithBalance = z.infer<typeof transactionWithBalanceSchema>;
export type AccountStatement = z.infer<typeof accountStatementSchema>;
