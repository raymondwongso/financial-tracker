import type { Account, Transaction } from '@ft/shared';
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
    expect((await list(`?accountId=${theirAccount.id}`)).json()).toEqual([]);
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

  it('requires authentication', async () => {
    expect((await app.inject({ method: 'GET', url: '/transactions' })).statusCode).toBe(401);
  });
});
