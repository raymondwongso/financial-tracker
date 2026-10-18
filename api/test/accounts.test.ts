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

describe('accounts', () => {
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

  it('creates an account with a zero balance and normalised currency', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/accounts',
      headers: { cookie: user.cookie },
      payload: { name: 'BCA Savings', type: 'bank', currency: 'idr' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({
      name: 'BCA Savings',
      type: 'bank',
      currency: 'IDR',
      balanceMinor: 0,
    });
  });

  it('lists only the current user’s accounts with balances from transactions', async () => {
    const wallet = await createAccountFor(app, user, { name: 'Wallet', type: 'cash' });
    await createTransactionFor(app, user, {
      accountId: wallet.id,
      type: 'income',
      amountMinor: 5000,
    });
    await createTransactionFor(app, user, {
      accountId: wallet.id,
      type: 'expense',
      amountMinor: 1200,
    });
    const other = await registerUser(app);
    await createAccountFor(app, other, { name: 'Not mine' });

    const res = await app.inject({
      method: 'GET',
      url: '/accounts',
      headers: { cookie: user.cookie },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([
      expect.objectContaining({ id: wallet.id, name: 'Wallet', balanceMinor: 3800 }),
    ]);
  });

  it('gets a single account by id', async () => {
    const account = await createAccountFor(app, user);
    const res = await app.inject({
      method: 'GET',
      url: `/accounts/${account.id}`,
      headers: { cookie: user.cookie },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(account);
  });

  it('returns 404 for another user’s account', async () => {
    const other = await registerUser(app);
    const theirs = await createAccountFor(app, other);
    const res = await app.inject({
      method: 'GET',
      url: `/accounts/${theirs.id}`,
      headers: { cookie: user.cookie },
    });
    expect(res.statusCode).toBe(404);
  });

  it('returns 400 for a malformed id', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/accounts/not-a-uuid',
      headers: { cookie: user.cookie },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects duplicate account names case-insensitively with 409', async () => {
    await createAccountFor(app, user, { name: 'Wallet' });
    const res = await app.inject({
      method: 'POST',
      url: '/accounts',
      headers: { cookie: user.cookie },
      payload: { name: 'wallet', type: 'cash', currency: 'USD' },
    });
    expect(res.statusCode).toBe(409);
  });

  it('allows the same account name for different users', async () => {
    await createAccountFor(app, user, { name: 'Wallet' });
    const other = await registerUser(app);
    await expect(createAccountFor(app, other, { name: 'Wallet' })).resolves.toMatchObject({
      name: 'Wallet',
    });
  });

  it('validates the payload', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/accounts',
      headers: { cookie: user.cookie },
      payload: { name: 'X', type: 'crypto', currency: 'DOLLARS' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().issues.map((i: { path: string }) => i.path)).toEqual(
      expect.arrayContaining(['type', 'currency']),
    );
  });

  it('requires authentication', async () => {
    expect((await app.inject({ method: 'GET', url: '/accounts' })).statusCode).toBe(401);
    expect((await app.inject({ method: 'POST', url: '/accounts', payload: {} })).statusCode).toBe(
      401,
    );
  });
});
