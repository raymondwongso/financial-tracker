import type { MonthlySummary } from '@ft/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { App } from '../src/types';
import {
  createAccountFor,
  createTestApp,
  createTransactionFor,
  registerUser,
  resetDb,
  type TestUser,
} from './helpers';

describe('monthly summary', () => {
  let app: App;
  let user: TestUser;

  beforeAll(async () => {
    app = await createTestApp();
  });
  beforeEach(async () => {
    await resetDb();
    user = await registerUser(app);
  });
  afterAll(() => app.close());

  const summary = async (month: string) => {
    const res = await app.inject({
      method: 'GET',
      url: `/summary/monthly?month=${month}`,
      headers: { cookie: user.cookie },
    });
    expect(res.statusCode).toBe(200);
    return res.json() as MonthlySummary;
  };

  it('returns empty totals for a month without transactions', async () => {
    expect(await summary('2026-10')).toEqual({
      month: '2026-10',
      totals: [],
      byAccount: [],
      byCategory: [],
    });
  });

  it('totals income, expense and net per currency and per account within the month only', async () => {
    const bank = await createAccountFor(app, user, { name: 'Bank', currency: 'USD' });
    const cash = await createAccountFor(app, user, { name: 'Cash', currency: 'USD' });
    const yen = await createAccountFor(app, user, { name: 'Yen wallet', currency: 'JPY' });

    await createTransactionFor(app, user, {
      accountId: bank.id,
      type: 'income',
      amountMinor: 500000,
      category: 'Salary',
      occurredOn: '2026-10-01',
    });
    await createTransactionFor(app, user, {
      accountId: bank.id,
      type: 'expense',
      amountMinor: 120000,
      category: 'Rent',
      occurredOn: '2026-10-02',
    });
    await createTransactionFor(app, user, {
      accountId: cash.id,
      type: 'expense',
      amountMinor: 2500,
      category: 'Food',
      occurredOn: '2026-10-31',
    });
    await createTransactionFor(app, user, {
      accountId: cash.id,
      type: 'expense',
      amountMinor: 1500,
      category: 'Food',
      occurredOn: '2026-10-15',
    });
    await createTransactionFor(app, user, {
      accountId: yen.id,
      type: 'expense',
      amountMinor: 3000,
      category: 'Food',
      occurredOn: '2026-10-10',
    });
    // Outside the month: must be ignored.
    await createTransactionFor(app, user, {
      accountId: bank.id,
      type: 'expense',
      amountMinor: 99999,
      category: 'Rent',
      occurredOn: '2026-11-01',
    });

    const result = await summary('2026-10');

    expect(result.totals).toEqual([
      { currency: 'JPY', incomeMinor: 0, expenseMinor: 3000, netMinor: -3000 },
      { currency: 'USD', incomeMinor: 500000, expenseMinor: 124000, netMinor: 376000 },
    ]);
    expect(result.byAccount).toEqual([
      {
        accountId: bank.id,
        accountName: 'Bank',
        currency: 'USD',
        incomeMinor: 500000,
        expenseMinor: 120000,
        netMinor: 380000,
      },
      {
        accountId: cash.id,
        accountName: 'Cash',
        currency: 'USD',
        incomeMinor: 0,
        expenseMinor: 4000,
        netMinor: -4000,
      },
      {
        accountId: yen.id,
        accountName: 'Yen wallet',
        currency: 'JPY',
        incomeMinor: 0,
        expenseMinor: 3000,
        netMinor: -3000,
      },
    ]);
    expect(result.byCategory).toEqual(
      expect.arrayContaining([
        { currency: 'USD', type: 'expense', category: 'Rent', totalMinor: 120000 },
        { currency: 'USD', type: 'expense', category: 'Food', totalMinor: 4000 },
        { currency: 'USD', type: 'income', category: 'Salary', totalMinor: 500000 },
        { currency: 'JPY', type: 'expense', category: 'Food', totalMinor: 3000 },
      ]),
    );
    expect(result.byCategory).toHaveLength(4);
  });

  it('excludes other users’ transactions', async () => {
    const other = await registerUser(app);
    const theirs = await createAccountFor(app, other);
    await createTransactionFor(app, other, { accountId: theirs.id, occurredOn: '2026-10-05' });
    expect((await summary('2026-10')).totals).toEqual([]);
  });

  it('validates the month parameter', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/summary/monthly',
      headers: { cookie: user.cookie },
    });
    expect(res.statusCode).toBe(400);
  });

  it('requires authentication', async () => {
    expect(
      (await app.inject({ method: 'GET', url: '/summary/monthly?month=2026-10' })).statusCode,
    ).toBe(401);
  });
});
