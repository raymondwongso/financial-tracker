import type Anthropic from '@anthropic-ai/sdk';
import type { Account, ChatResponse, Transaction } from '@ft/shared';
import { buildApp as buildMcpApp } from '@ft/mcp/app';
import { loadConfig as loadMcpConfig } from '@ft/mcp/config';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';
import { MAX_TOOL_ITERATIONS } from '../src/chat/chat-service';
import type { LlmClient, LlmRequest, LlmResponse } from '../src/chat/llm';
import type { App } from '../src/types';
import {
  createTestApp,
  registerUser,
  resetDb,
  testConfig,
  TEST_DATABASE_URL,
  type TestUser,
} from './helpers';

async function startMcp(): Promise<{ mcp: FastifyInstance; url: string }> {
  const mcp = await buildMcpApp(
    loadMcpConfig({
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      DATABASE_URL: TEST_DATABASE_URL,
      MCP_INTERNAL_SECRET: testConfig().MCP_INTERNAL_SECRET,
    }),
  );
  const address = await mcp.listen({ host: '127.0.0.1', port: 0 });
  return { mcp, url: `${address}/mcp` };
}

/** LLM whose responses are produced by a function, recording every request it receives. */
class ScriptedLlm implements LlmClient {
  readonly requests: LlmRequest[] = [];
  constructor(private readonly script: (request: LlmRequest, call: number) => LlmResponse) {}
  async complete(request: LlmRequest): Promise<LlmResponse> {
    this.requests.push(structuredClone(request));
    return this.script(request, this.requests.length);
  }
}

const toolUse = (name: string, input: Record<string, unknown>, id = `toolu_${name}`): LlmResponse =>
  ({ stop_reason: 'tool_use', content: [{ type: 'tool_use', id, name, input }] }) as LlmResponse;
const text = (value: string): LlmResponse => ({
  stop_reason: 'end_turn',
  content: [{ type: 'text', text: value, citations: null }],
});

describe('POST /chat', () => {
  let mcp: FastifyInstance;
  let mcpUrl: string;
  let app: App;
  let user: TestUser;

  beforeAll(async () => {
    ({ mcp, url: mcpUrl } = await startMcp());
    app = await createTestApp({ MCP_URL: mcpUrl });
  });
  beforeEach(async () => {
    await resetDb();
    user = await registerUser(app);
  });
  afterAll(async () => {
    await app.close();
    await mcp.close();
  });

  const chat = (who: TestUser, ...contents: string[]) =>
    app.inject({
      method: 'POST',
      url: '/chat',
      headers: { cookie: who.cookie },
      payload: { messages: contents.map((content) => ({ role: 'user', content })) },
    });

  const accountsOf = async (who: TestUser) =>
    (
      await app.inject({ method: 'GET', url: '/accounts', headers: { cookie: who.cookie } })
    ).json() as Account[];

  it('creates an account through the MCP create_account tool', async () => {
    const res = await chat(user, 'Create a cash account called Wallet in USD');
    expect(res.statusCode).toBe(200);
    const body = res.json() as ChatResponse;
    expect(body.toolCalls).toEqual([
      {
        name: 'create_account',
        input: { name: 'Wallet', type: 'cash', currency: 'USD' },
        isError: false,
      },
    ]);
    expect(body.reply).toContain('Wallet');
    expect(await accountsOf(user)).toEqual([
      expect.objectContaining({ name: 'Wallet', type: 'cash', currency: 'USD' }),
    ]);
  });

  it('records an expense through create_transaction in minor units', async () => {
    await chat(user, 'Create a cash account called Wallet in USD');
    const res = await chat(user, 'I spent 12.50 on Food from Wallet');
    expect(res.statusCode).toBe(200);
    expect((res.json() as ChatResponse).toolCalls[0]).toMatchObject({
      name: 'create_transaction',
      isError: false,
    });

    const txs = (
      await app.inject({ method: 'GET', url: '/transactions', headers: { cookie: user.cookie } })
    ).json() as Transaction[];
    expect(txs).toEqual([
      expect.objectContaining({ type: 'expense', amountMinor: 1250, category: 'Food' }),
    ]);
  });

  it('summarises a month through monthly_summary', async () => {
    const res = await chat(user, 'Summarise 2026-10');
    expect((res.json() as ChatResponse).toolCalls).toEqual([
      { name: 'monthly_summary', input: { month: '2026-10' }, isError: false },
    ]);
  });

  it('answers without tools when no tool applies', async () => {
    const body = (await chat(user, 'hello there')).json() as ChatResponse;
    expect(body.toolCalls).toEqual([]);
    expect(body.reply).toMatch(/I can create accounts/);
  });

  it('surfaces tool errors to the user', async () => {
    const body = (await chat(user, 'I spent 5 on Food from Nowhere')).json() as ChatResponse;
    expect(body.toolCalls).toEqual([
      expect.objectContaining({ name: 'create_transaction', isError: true }),
    ]);
    expect(body.reply).toMatch(/Sorry/);
  });

  it('acts only on the logged-in user’s data', async () => {
    await chat(user, 'Create a bank account called Private in USD');
    const other = await registerUser(app);
    await chat(other, 'I spent 5 on Food from Private');
    expect(await accountsOf(other)).toEqual([]);
    const txs = (
      await app.inject({ method: 'GET', url: '/transactions', headers: { cookie: user.cookie } })
    ).json();
    expect(txs).toEqual([]);
  });

  it('validates the conversation and requires authentication', async () => {
    const bad = await app.inject({
      method: 'POST',
      url: '/chat',
      headers: { cookie: user.cookie },
      payload: { messages: [{ role: 'assistant', content: 'hi' }] },
    });
    expect(bad.statusCode).toBe(400);
    const anon = await app.inject({ method: 'POST', url: '/chat', payload: { messages: [] } });
    expect(anon.statusCode).toBe(401);
  });

  describe('with a scripted LLM', () => {
    const withLlm = async (llm: LlmClient, overrides = {}) => {
      const scripted = await buildApp(testConfig({ MCP_URL: mcpUrl, ...overrides }), { llm });
      await scripted.ready();
      const who = await registerUser(scripted);
      return { scripted, who };
    };

    it('offers the MCP tools to Claude and sends tool results back with the matching id', async () => {
      const llm = new ScriptedLlm((_req, call) =>
        call === 1 ? toolUse('list_accounts', {}, 'toolu_1') : text('You have no accounts yet.'),
      );
      const { scripted, who } = await withLlm(llm);
      try {
        const res = await scripted.inject({
          method: 'POST',
          url: '/chat',
          headers: { cookie: who.cookie },
          payload: { messages: [{ role: 'user', content: 'What accounts do I have?' }] },
        });
        expect(res.json()).toEqual({
          reply: 'You have no accounts yet.',
          toolCalls: [{ name: 'list_accounts', input: {}, isError: false }],
        });

        const [first, second] = llm.requests;
        expect(first!.tools.map((t) => t.name).sort()).toEqual([
          'create_account',
          'create_transaction',
          'list_accounts',
          'list_transactions',
          'monthly_summary',
        ]);
        expect(first!.tools[0]!.input_schema).toMatchObject({ type: 'object' });
        const lastMessage = second!.messages.at(-1)!;
        expect(lastMessage.role).toBe('user');
        const result = (lastMessage.content as Anthropic.ToolResultBlockParam[])[0]!;
        expect(result).toMatchObject({
          type: 'tool_result',
          tool_use_id: 'toolu_1',
          is_error: false,
        });
        expect(result.content).toBe('[]');
      } finally {
        await scripted.close();
      }
    });

    it(`stops after ${MAX_TOOL_ITERATIONS} tool iterations`, async () => {
      const llm = new ScriptedLlm((_req, call) => toolUse('list_accounts', {}, `toolu_${call}`));
      const { scripted, who } = await withLlm(llm);
      try {
        const body = (
          await scripted.inject({
            method: 'POST',
            url: '/chat',
            headers: { cookie: who.cookie },
            payload: { messages: [{ role: 'user', content: 'loop forever' }] },
          })
        ).json() as ChatResponse;
        expect(body.toolCalls).toHaveLength(MAX_TOOL_ITERATIONS);
        expect(body.reply).toMatch(/too many steps/);
      } finally {
        await scripted.close();
      }
    });

    it('handles a refusal', async () => {
      const llm = new ScriptedLlm(() => ({ stop_reason: 'refusal', content: [] }));
      const { scripted, who } = await withLlm(llm);
      try {
        const body = (
          await scripted.inject({
            method: 'POST',
            url: '/chat',
            headers: { cookie: who.cookie },
            payload: { messages: [{ role: 'user', content: 'something disallowed' }] },
          })
        ).json() as ChatResponse;
        expect(body.reply).toMatch(/can’t help/);
      } finally {
        await scripted.close();
      }
    });

    it('returns 502 when the LLM fails', async () => {
      const llm = new ScriptedLlm(() => {
        throw new Error('upstream down');
      });
      const { scripted, who } = await withLlm(llm);
      try {
        const res = await scripted.inject({
          method: 'POST',
          url: '/chat',
          headers: { cookie: who.cookie },
          payload: { messages: [{ role: 'user', content: 'hi' }] },
        });
        expect(res.statusCode).toBe(502);
        expect(res.json()).toMatchObject({ error: 'AssistantUnavailable' });
        expect(res.body).not.toContain('upstream down');
      } finally {
        await scripted.close();
      }
    });

    it('returns 502 when the MCP server is unreachable', async () => {
      const { scripted, who } = await withLlm(new ScriptedLlm(() => text('unused')), {
        MCP_URL: 'http://127.0.0.1:9/mcp',
      });
      try {
        const res = await scripted.inject({
          method: 'POST',
          url: '/chat',
          headers: { cookie: who.cookie },
          payload: { messages: [{ role: 'user', content: 'hi' }] },
        });
        expect(res.statusCode).toBe(502);
      } finally {
        await scripted.close();
      }
    });
  });
});
