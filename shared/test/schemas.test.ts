import { describe, expect, it } from 'vitest';
import {
  chatRequestSchema,
  createAccountSchema,
  createTransactionSchema,
  listTransactionsQuerySchema,
  loginSchema,
  monthlySummaryQuerySchema,
  registerSchema,
} from '../src';

const uuid = '3f1b1c5e-8d7a-4f3e-9a51-2b7c6d8e9f01';

describe('auth schemas', () => {
  it('normalises email and accepts a valid registration', () => {
    const parsed = registerSchema.parse({
      name: ' Ray ',
      email: ' Ray@Example.COM ',
      password: 'secret123',
    });
    expect(parsed).toEqual({ name: 'Ray', email: 'ray@example.com', password: 'secret123' });
  });

  it('rejects short passwords and invalid emails', () => {
    expect(
      registerSchema.safeParse({ name: 'a', email: 'a@b.co', password: 'short' }).success,
    ).toBe(false);
    expect(loginSchema.safeParse({ email: 'not-an-email', password: 'x' }).success).toBe(false);
  });
});

describe('account schemas', () => {
  it('upper-cases the currency code', () => {
    expect(
      createAccountSchema.parse({ name: 'Wallet', type: 'cash', currency: 'usd' }).currency,
    ).toBe('USD');
  });

  it('rejects unknown account types and bad currencies', () => {
    expect(
      createAccountSchema.safeParse({ name: 'X', type: 'crypto', currency: 'USD' }).success,
    ).toBe(false);
    expect(createAccountSchema.safeParse({ name: 'X', type: 'cash', currency: 'US' }).success).toBe(
      false,
    );
  });
});

describe('transaction schemas', () => {
  const valid = {
    accountId: uuid,
    type: 'expense',
    amountMinor: 1250,
    category: 'Food',
    occurredOn: '2026-10-01',
  };

  it('accepts a valid transaction', () => {
    expect(createTransactionSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects zero, negative and fractional amounts', () => {
    for (const amountMinor of [0, -5, 12.5]) {
      expect(createTransactionSchema.safeParse({ ...valid, amountMinor }).success).toBe(false);
    }
  });

  it('rejects invalid dates', () => {
    expect(createTransactionSchema.safeParse({ ...valid, occurredOn: '2026-13-01' }).success).toBe(
      false,
    );
  });

  it('validates list filters', () => {
    expect(listTransactionsQuerySchema.safeParse({ month: '2026-10' }).success).toBe(true);
    expect(listTransactionsQuerySchema.safeParse({ month: '2026-1' }).success).toBe(false);
    expect(monthlySummaryQuerySchema.safeParse({ month: '2026-00' }).success).toBe(false);
  });
});

describe('chat schemas', () => {
  it('requires the last message to come from the user', () => {
    expect(
      chatRequestSchema.safeParse({ messages: [{ role: 'user', content: 'hi' }] }).success,
    ).toBe(true);
    expect(
      chatRequestSchema.safeParse({
        messages: [
          { role: 'user', content: 'hi' },
          { role: 'assistant', content: 'hello' },
        ],
      }).success,
    ).toBe(false);
  });

  it('rejects empty conversations', () => {
    expect(chatRequestSchema.safeParse({ messages: [] }).success).toBe(false);
  });
});
