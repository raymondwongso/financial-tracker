import { randomUUID } from 'node:crypto';
import type { Account, CreateAccountInput, CreateTransactionInput, Transaction } from '@ft/shared';
import { createDb } from '@ft/shared/db';
import { sql } from 'drizzle-orm';
import { buildApp } from '../src/app';
import { loadConfig, type Config } from '../src/config';
import type { App } from '../src/types';

export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL!;

export function testConfig(overrides: Partial<Record<keyof Config, string>> = {}): Config {
  return loadConfig({
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    DATABASE_URL: TEST_DATABASE_URL,
    JWT_SECRET: 'test-jwt-secret-that-is-at-least-32-chars',
    MCP_INTERNAL_SECRET: 'test-mcp-secret-that-is-at-least-32-chars',
    AUTH_RATE_LIMIT: '1000',
    CHAT_RATE_LIMIT: '1000',
    LLM_PROVIDER: 'fake',
    ...overrides,
  });
}

export async function createTestApp(
  overrides: Parameters<typeof testConfig>[0] = {},
): Promise<App> {
  const app = await buildApp(testConfig(overrides));
  await app.ready();
  return app;
}

/** Removes all rows; users cascade to accounts and transactions. */
export async function resetDb(): Promise<void> {
  const { db, close } = createDb(TEST_DATABASE_URL, { max: 1 });
  try {
    await db.execute(sql`truncate table users cascade`);
  } finally {
    await close();
  }
}

export interface TestUser {
  id: string;
  email: string;
  cookie: string;
}

/** Registers a fresh user and returns its session cookie header value. */
export async function registerUser(
  app: App,
  email = `user-${randomUUID()}@example.com`,
): Promise<TestUser> {
  const res = await app.inject({
    method: 'POST',
    url: '/auth/register',
    payload: { name: 'Test User', email, password: 'correct-horse-battery' },
  });
  if (res.statusCode !== 201) throw new Error(`register failed: ${res.statusCode} ${res.body}`);
  const session = res.cookies.find((c) => c.name === 'ft_session');
  if (!session) throw new Error('no session cookie set');
  return { id: res.json().id, email, cookie: `ft_session=${session.value}` };
}

export async function createAccountFor(
  app: App,
  user: TestUser,
  input: Partial<CreateAccountInput> = {},
): Promise<Account> {
  const res = await app.inject({
    method: 'POST',
    url: '/accounts',
    headers: { cookie: user.cookie },
    payload: {
      name: `Account ${randomUUID().slice(0, 8)}`,
      type: 'bank',
      currency: 'USD',
      ...input,
    },
  });
  if (res.statusCode !== 201)
    throw new Error(`create account failed: ${res.statusCode} ${res.body}`);
  return res.json();
}

export async function createTransactionFor(
  app: App,
  user: TestUser,
  input: Partial<CreateTransactionInput> & { accountId: string },
): Promise<Transaction> {
  const res = await app.inject({
    method: 'POST',
    url: '/transactions',
    headers: { cookie: user.cookie },
    payload: {
      type: 'expense',
      amountMinor: 1000,
      category: 'Food',
      occurredOn: '2026-10-05',
      ...input,
    },
  });
  if (res.statusCode !== 201)
    throw new Error(`create transaction failed: ${res.statusCode} ${res.body}`);
  return res.json();
}
