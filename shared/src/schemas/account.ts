import { z } from 'zod';
import { currencySchema } from './common';

export const accountTypes = ['cash', 'bank', 'credit_card', 'e_wallet', 'investment'] as const;
export const accountTypeSchema = z.enum(accountTypes);

export const createAccountSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  type: accountTypeSchema,
  currency: currencySchema,
});

export const accountSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  type: accountTypeSchema,
  currency: z.string(),
  /** Income minus expenses across all transactions, in minor units. */
  balanceMinor: z.number().int(),
  createdAt: z.string(),
});

export const accountListSchema = z.array(accountSchema);

export type AccountType = z.infer<typeof accountTypeSchema>;
export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type Account = z.infer<typeof accountSchema>;
