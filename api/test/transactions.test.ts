import type { Account, Transaction } from '@ft/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { App } from '../src/types';
import { createDb, schema } from '@ft/shared/db';
import {
  TEST_DATABASE_URL,
  createAccountFor,
  createTestApp,
  createTransactionFor,
  registerUser,
  resetDb,
  type TestUser,
} from './helpers';

describe('transactions', () => {
  let app: App;
  let user: TestUser;
  let account: Account;

  beforeAll(async () => {
    app = await createTestApp();
  });
  beforeEach(async () => {
    await resetDb();
    user = await registerUser(app);
    account = await createAccountFor(app, user, { name: 'Main' });
  });
  afterAll(() => app.close());

  const list = (query = '') =>
    app.inject({ method: 'GET', url: `/transactions${query}`, headers: { cookie: user.cookie } });

  it('creates a transaction', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/transactions',
      headers: { cookie: user.cookie },
      payload: {
        accountId: account.id,
        type: 'expense',
        amountMinor: 4550,
        category: 'Groceries',
        description: 'Weekly shop',
        occurredOn: '2026-10-03',
      },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({
      accountId: account.id,
      type: 'expense',
      amountMinor: 4550,
      category: 'Groceries',
      description: 'Weekly shop',
      occurredOn: '2026-10-03',
    });
  });

  it('stores an omitted description as null', async () => {
    const tx = await createTransactionFor(app, user, { accountId: account.id });
    expect(tx.description).toBeNull();
  });

  it('lists transactions newest first', async () => {
    await createTransactionFor(app, user, { accountId: account.id, occurredOn: '2026-10-01' });
    await createTransactionFor(app, user, { accountId: account.id, occurredOn: '2026-10-20' });
    const res = await list();
    expect(res.statusCode).toBe(200);
    expect(res.json().map((t: Transaction) => t.occurredOn)).toEqual(['2026-10-20', '2026-10-01']);
  });

  it('filters by account and by month (inclusive of month boundaries)', async () => {
    const savings = await createAccountFor(app, user, { name: 'Savings' });
    await createTransactionFor(app, user, { accountId: account.id, occurredOn: '2026-09-30' });
    await createTransactionFor(app, user, { accountId: account.id, occurredOn: '2026-10-01' });
    await createTransactionFor(app, user, { accountId: account.id, occurredOn: '2026-10-31' });
    await createTransactionFor(app, user, { accountId: savings.id, occurredOn: '2026-10-15' });
    await createTransactionFor(app, user, { accountId: account.id, occurredOn: '2026-11-01' });

    const october = (await list('?month=2026-10')).json() as Transaction[];
    expect(october.map((t) => t.occurredOn).sort()).toEqual([
      '2026-10-01',
      '2026-10-15',
      '2026-10-31',
    ]);

    const mainOctober = (
      await list(`?month=2026-10&accountId=${account.id}`)
    ).json() as Transaction[];
    expect(mainOctober).toHaveLength(2);
    expect(mainOctober.every((t) => t.accountId === account.id)).toBe(true);
  });

  it('never lists another user’s transactions', async () => {
    const other = await registerUser(app);
    const theirAccount = await createAccountFor(app, other);
    await createTransactionFor(app, other, { accountId: theirAccount.id });

    expect((await list()).json()).toEqual([]);
    // Another user's account is reported as not found (no data, no existence leak).
    expect((await list(`?accountId=${theirAccount.id}`)).statusCode).toBe(404);
  });

  it('returns 404 when adding to another user’s account', async () => {
    const other = await registerUser(app);
    const theirAccount = await createAccountFor(app, other);
    const res = await app.inject({
      method: 'POST',
      url: '/transactions',
      headers: { cookie: user.cookie },
      payload: {
        accountId: theirAccount.id,
        type: 'income',
        amountMinor: 100,
        category: 'Gift',
        occurredOn: '2026-10-01',
      },
    });
    expect(res.statusCode).toBe(404);
  });

  it('rejects non-positive and fractional amounts', async () => {
    for (const amountMinor of [0, -100, 10.5]) {
      const res = await app.inject({
        method: 'POST',
        url: '/transactions',
        headers: { cookie: user.cookie },
        payload: {
          accountId: account.id,
          type: 'expense',
          amountMinor,
          category: 'Food',
          occurredOn: '2026-10-01',
        },
      });
      expect(res.statusCode).toBe(400);
    }
  });

  it('rejects an invalid month filter', async () => {
    expect((await list('?month=October')).statusCode).toBe(400);
  });

  it('includes running balances (with the opening balance before the range) for one account', async () => {
    const add = (type: 'income' | 'expense', amountMinor: number, occurredOn: string) =>
      createTransactionFor(app, user, { accountId: account.id, type, amountMinor, occurredOn });
    await add('income', 10000, '2026-09-15'); // before the range → opening balance 100.00
    await add('income', 25000, '2026-10-01');
    await add('expense', 1250, '2026-10-18');
    await add('expense', 480, '2026-10-18');
    await add('expense', 99999, '2026-11-01'); // after the range → ignored

    const rows = (
      await list(`?accountId=${account.id}&from=2026-10-01&to=2026-10-31`)
    ).json() as Array<Transaction & { runningBalanceMinor: number }>;
    // Newest first; the running balance is the account balance right after each transaction.
    expect(rows.map((r) => [r.occurredOn, r.runningBalanceMinor])).toEqual([
      ['2026-10-18', 33270],
      ['2026-10-18', 33750],
      ['2026-10-01', 35000],
    ]);

    const byMonth = (await list(`?accountId=${account.id}&month=2026-10`)).json();
    expect(byMonth).toEqual(rows);
  });

  it('returns the newest 500 rows of a long statement with correct balances', async () => {
    const { db, close } = createDb(TEST_DATABASE_URL, { max: 1 });
    try {
      // 505 daily income transactions of 1.00 starting 2025-01-01.
      const start = Date.UTC(2025, 0, 1);
      await db.insert(schema.transactions).values(
        Array.from({ length: 505 }, (_, i) => ({
          userId: user.id,
          accountId: account.id,
          type: 'income' as const,
          amountMinor: 100,
          category: 'Daily',
          occurredOn: new Date(start + i * 86_400_000).toISOString().slice(0, 10),
        })),
      );
    } finally {
      await close();
    }
    const rows = (await list(`?accountId=${account.id}`)).json() as Array<
      Transaction & { runningBalanceMinor: number }
    >;
    expect(rows).toHaveLength(500);
    // Newest first, and the newest row carries the true closing balance (505 × 1.00).
    expect(rows[0]!.runningBalanceMinor).toBe(50500);
    expect(rows.at(-1)!.runningBalanceMinor).toBe(600);
  });

  it('omits running balances when listing across accounts', async () => {
    await createTransactionFor(app, user, { accountId: account.id });
    const [row] = (await list()).json();
    expect(row).not.toHaveProperty('runningBalanceMinor');
  });

  it('filters by an inclusive from/to range', async () => {
    for (const occurredOn of ['2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07']) {
      await createTransactionFor(app, user, { accountId: account.id, occurredOn });
    }
    const rows = (await list('?from=2026-10-05&to=2026-10-06')).json() as Transaction[];
    expect(rows.map((r) => r.occurredOn)).toEqual(['2026-10-06', '2026-10-05']);
  });

  it('rejects inconsistent range filters', async () => {
    expect((await list('?from=2026-10-01')).statusCode).toBe(400);
    expect((await list('?from=2026-10-31&to=2026-10-01')).statusCode).toBe(400);
    expect((await list('?month=2026-10&from=2026-10-01&to=2026-10-31')).statusCode).toBe(400);
  });

  it('requires authentication', async () => {
    expect((await app.inject({ method: 'GET', url: '/transactions' })).statusCode).toBe(401);
  });
});
