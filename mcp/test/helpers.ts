import { randomUUID } from 'node:crypto';
import { createDb, createUser, type DbHandle } from '@ft/shared/db';
import { signInternalToken } from '@ft/shared/server';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app';
import { loadConfig } from '../src/config';

export const SECRET = 'test-mcp-secret-that-is-at-least-32-chars';

export async function startServer(): Promise<{ app: FastifyInstance; url: string }> {
  const app = await buildApp(
    loadConfig({
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      DATABASE_URL: process.env.TEST_DATABASE_URL,
      MCP_INTERNAL_SECRET: SECRET,
    }),
  );
  const address = await app.listen({ host: '127.0.0.1', port: 0 });
  return { app, url: `${address}/mcp` };
}

export function openDb(): DbHandle {
  return createDb(process.env.TEST_DATABASE_URL!, { max: 2 });
}

/** Removes all rows; users cascade to accounts and transactions. */
export async function resetDb(handle: DbHandle): Promise<void> {
  await handle.db.execute(sql`truncate table users cascade`);
}

export async function createTestUser(handle: DbHandle): Promise<string> {
  const user = await createUser(handle.db, {
    name: 'MCP Tester',
    email: `mcp-${randomUUID()}@example.com`,
    passwordHash: 'not-used',
  });
  return user.id;
}

export async function connectClient(url: string, token: string): Promise<Client> {
  const client = new Client({ name: 'mcp-test', version: '1.0.0' });
  const transport = new StreamableHTTPClientTransport(new URL(url), {
    requestInit: { headers: { Authorization: `Bearer ${token}` } },
  });
  await client.connect(transport);
  return client;
}

export async function clientFor(url: string, userId: string): Promise<Client> {
  return connectClient(url, await signInternalToken(SECRET, userId));
}

/** Calls a tool and parses its JSON text payload. */
export async function call<T = unknown>(
  client: Client,
  name: string,
  args: Record<string, unknown> = {},
): Promise<{
  isError: boolean;
  data: T;
  text: string;
  structured: Record<string, unknown> | undefined;
}> {
  const result = (await client.callTool({ name, arguments: args })) as CallToolResult;
  const first = result.content[0];
  const text = first && first.type === 'text' ? first.text : '';
  let data: T;
  try {
    data = JSON.parse(text) as T;
  } catch {
    data = text as T;
  }
  return {
    isError: result.isError === true,
    data,
    text,
    structured: result.structuredContent as Record<string, unknown> | undefined,
  };
}
