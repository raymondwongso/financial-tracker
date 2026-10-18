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

export const transactionListSchema = z.array(transactionSchema);

export const listTransactionsQuerySchema = z.object({
  accountId: idSchema.optional(),
  month: monthSchema.optional(),
});

export type TransactionType = z.infer<typeof transactionTypeSchema>;
export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type Transaction = z.infer<typeof transactionSchema>;
export type ListTransactionsQuery = z.infer<typeof listTransactionsQuerySchema>;
