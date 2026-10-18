import type { DbHandle } from '@ft/shared/db';
import { listTransactions } from '@ft/shared/db';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  call,
  clientFor,
  connectClient,
  createTestUser,
  openDb,
  resetDb,
  startServer,
} from './helpers';

describe('MCP server', () => {
  let app: FastifyInstance;
  let url: string;
  let handle: DbHandle;
  let userId: string;
  let client: Client;

  beforeAll(async () => {
    ({ app, url } = await startServer());
    handle = openDb();
  });
  beforeEach(async () => {
    await resetDb(handle);
    userId = await createTestUser(handle);
    client = await clientFor(url, userId);
  });
  afterEach(() => client.close());
  afterAll(async () => {
    await app.close();
    await handle.close();
  });

  it('lists all finance tools without a user id argument', async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      'create_account',
      'create_transaction',
      'list_accounts',
      'list_transactions',
      'monthly_summary',
    ]);
    const create = tools.find((t) => t.name === 'create_transaction');
    expect(create?.inputSchema.required).toEqual(
      expect.arrayContaining(['account', 'type', 'amount', 'category']),
    );
    expect(create?.inputSchema.properties).not.toHaveProperty('userId');
  });

  it('create_account persists an account for the token user', async () => {
    const res = await call(client, 'create_account', {
      name: 'Wallet',
      type: 'cash',
      currency: 'usd',
    });
    expect(res.isError).toBe(false);
    expect(res.structured).toEqual({
      account: {
        id: expect.any(String),
        name: 'Wallet',
        type: 'cash',
        currency: 'USD',
        balanceMinor: 0,
      },
    });
    expect(res.data).toMatchObject({ created: 'Wallet', balance: '$0.00' });

    const listed = await call<Array<{ name: string }>>(client, 'list_accounts');
    expect(listed.data.map((a) => a.name)).toEqual(['Wallet']);
  });

  it('create_account reports duplicates as a tool error', async () => {
    await call(client, 'create_account', { name: 'Wallet', type: 'cash', currency: 'USD' });
    const res = await call(client, 'create_account', {
      name: 'wallet',
      type: 'cash',
      currency: 'USD',
    });
    expect(res.isError).toBe(true);
    expect(res.text).toMatch(/already exists/);
  });

  it('create_transaction resolves the account by name and converts major units', async () => {
    await call(client, 'create_account', { name: 'Wallet', type: 'cash', currency: 'USD' });
    const res = await call(client, 'create_transaction', {
      account: 'wallet',
      type: 'expense',
      amount: 12.5,
      category: 'Food',
      description: 'Lunch',
      occurredOn: '2026-10-18',
    });
    expect(res.isError).toBe(false);
    expect(res.structured).toEqual({
      transaction: {
        id: expect.any(String),
        accountId: expect.any(String),
        accountName: 'Wallet',
        currency: 'USD',
        type: 'expense',
        amountMinor: 1250,
        category: 'Food',
        description: 'Lunch',
        occurredOn: '2026-10-18',
      },
    });
    expect(res.data).toMatchObject({ account: 'Wallet', amount: '-$12.50' });

    const rows = await listTransactions(handle.db, userId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ amountMinor: 1250, type: 'expense', category: 'Food' });
  });

  it('create_transaction defaults the date to today', async () => {
    await call(client, 'create_account', { name: 'Wallet', type: 'cash', currency: 'USD' });
    const res = await call<{ occurredOn: string }>(client, 'create_transaction', {
      account: 'Wallet',
      type: 'income',
      amount: 100,
      category: 'Gift',
    });
    expect(res.data.occurredOn).toBe(new Date().toISOString().slice(0, 10));
  });

  it('create_transaction explains when the account does not exist', async () => {
    await call(client, 'create_account', { name: 'Wallet', type: 'cash', currency: 'USD' });
    const res = await call(client, 'create_transaction', {
      account: 'Savings',
      type: 'expense',
      amount: 5,
      category: 'Food',
    });
    expect(res.isError).toBe(true);
    expect(res.text).toContain('Existing accounts: Wallet');
  });

  it('rejects amounts too large to store', async () => {
    await call(client, 'create_account', { name: 'Wallet', type: 'cash', currency: 'USD' });
    const res = await call(client, 'create_transaction', {
      account: 'Wallet',
      type: 'income',
      amount: 1e20,
      category: 'Lottery',
    });
    expect(res.isError).toBe(true);
    expect(res.text).toBe('Amount is too large.');
  });

  it('rejects invalid tool input', async () => {
    const res = await call(client, 'create_transaction', {
      account: 'Wallet',
      type: 'expense',
      amount: -5,
      category: 'Food',
    });
    expect(res.isError).toBe(true);
  });

  it('list_transactions returns one account and date range with running balances', async () => {
    await call(client, 'create_account', { name: 'Wallet', type: 'cash', currency: 'USD' });
    await call(client, 'create_account', { name: 'Bank', type: 'bank', currency: 'USD' });
    const add = (account: string, type: string, amount: number, occurredOn: string) =>
      call(client, 'create_transaction', { account, type, amount, category: 'Misc', occurredOn });
    await add('Wallet', 'income', 100, '2026-09-30'); // before the range → opening balance
    await add('Wallet', 'income', 250, '2026-10-01');
    await add('Wallet', 'expense', 12.5, '2026-10-18');
    await add('Bank', 'expense', 1, '2026-10-02'); // other account → excluded

    const res = await call<{ closingBalance: string }>(client, 'list_transactions', {
      account: 'Wallet',
      startDate: '2026-10-01',
      endDate: '2026-10-31',
    });
    expect(res.isError).toBe(false);
    expect(res.structured).toMatchObject({
      account: { name: 'Wallet', currency: 'USD' },
      from: '2026-10-01',
      to: '2026-10-31',
      openingBalanceMinor: 10000,
      closingBalanceMinor: 33750,
    });
    const rows = (res.structured!.transactions as Array<Record<string, unknown>>).map((t) => [
      t.occurredOn,
      t.runningBalanceMinor,
    ]);
    expect(rows).toEqual([
      ['2026-10-01', 35000],
      ['2026-10-18', 33750],
    ]);
    expect(res.data.closingBalance).toBe('$337.50');
  });

  it('list_transactions requires an account and both dates', async () => {
    await call(client, 'create_account', { name: 'Wallet', type: 'cash', currency: 'USD' });
    for (const args of [
      { account: 'Wallet' },
      { startDate: '2026-10-01', endDate: '2026-10-31' },
      { account: 'Wallet', startDate: '2026-10-31', endDate: '2026-10-01' },
    ]) {
      expect((await call(client, 'list_transactions', args)).isError).toBe(true);
    }
  });

  it('monthly_summary requires the month', async () => {
    expect((await call(client, 'monthly_summary', {})).isError).toBe(true);
  });

  it('monthly_summary returns formatted totals', async () => {
    await call(client, 'create_account', { name: 'Bank', type: 'bank', currency: 'USD' });
    await call(client, 'create_transaction', {
      account: 'Bank',
      type: 'income',
      amount: 5000,
      category: 'Salary',
      occurredOn: '2026-10-01',
    });
    await call(client, 'create_transaction', {
      account: 'Bank',
      type: 'expense',
      amount: 1200,
      category: 'Rent',
      occurredOn: '2026-10-02',
    });

    const res = await call<{ totals: unknown[] }>(client, 'monthly_summary', { month: '2026-10' });
    expect(res.data.totals).toEqual([
      { currency: 'USD', income: '$5,000.00', expense: '$1,200.00', net: '+$3,800.00' },
    ]);
    expect(res.structured).toMatchObject({
      month: '2026-10',
      totals: [{ currency: 'USD', incomeMinor: 500000, expenseMinor: 120000, netMinor: 380000 }],
      byAccount: [{ accountName: 'Bank', currency: 'USD' }],
    });
  });

  it('never exposes or modifies another user’s data', async () => {
    await call(client, 'create_account', { name: 'Private', type: 'bank', currency: 'USD' });

    const otherId = await createTestUser(handle);
    const other = await clientFor(url, otherId);
    try {
      expect((await call(other, 'list_accounts')).data).toEqual([]);
      const res = await call(other, 'create_transaction', {
        account: 'Private',
        type: 'expense',
        amount: 1,
        category: 'X',
      });
      expect(res.isError).toBe(true);
      expect(await listTransactions(handle.db, userId)).toEqual([]);
    } finally {
      await other.close();
    }
  });
});

describe('MCP server auth and observability', () => {
  let app: FastifyInstance;
  let url: string;

  beforeAll(async () => {
    ({ app, url } = await startServer());
  });
  afterAll(() => app.close());

  it('rejects requests without a valid internal token', async () => {
    await expect(connectClient(url, 'not-a-token')).rejects.toThrow();
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    });
    expect(res.status).toBe(401);
  });

  it('exposes health and prometheus metrics with tool counters', async () => {
    const health = await fetch(url.replace('/mcp', '/health'));
    expect(health.status).toBe(200);
    const metrics = await (await fetch(url.replace('/mcp', '/metrics'))).text();
    expect(metrics).toContain('mcp_tool_calls_total');
    expect(metrics).toContain('service="mcp"');
  });
});
