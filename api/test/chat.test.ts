import type Anthropic from '@anthropic-ai/sdk';
import type {
  Account,
  ChatCard,
  ChatCardsPage,
  ChatMessage,
  ChatMessagesPage,
  ChatSendResponse,
  Transaction,
} from '@ft/shared';
import { createDb, saveChatTurn } from '@ft/shared/db';
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

describe('chat', () => {
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

  const send = (who: TestUser, message: string) =>
    app.inject({
      method: 'POST',
      url: '/chat',
      headers: { cookie: who.cookie },
      payload: { message },
    });
  const sendOk = async (who: TestUser, message: string) => {
    const res = await send(who, message);
    expect(res.statusCode).toBe(200);
    return res.json() as ChatSendResponse;
  };
  const get = (who: TestUser, url: string) =>
    app.inject({ method: 'GET', url, headers: { cookie: who.cookie } });
  const accountsOf = async (who: TestUser) => (await get(who, '/accounts')).json() as Account[];
  const kinds = (cards: ChatCard[]) => cards.map((c) => c.kind);

  describe('POST /chat', () => {
    it('creates an account through MCP and returns both messages with an account card', async () => {
      const body = await sendOk(user, 'Create a cash account called Wallet in USD');
      expect(body.userMessage).toMatchObject({
        role: 'user',
        content: 'Create a cash account called Wallet in USD',
        cards: [],
      });
      expect(body.assistantMessage.role).toBe('assistant');
      expect(body.assistantMessage.content).toContain('Wallet');
      expect(body.assistantMessage.cards).toEqual([
        {
          id: expect.any(String),
          createdAt: expect.any(String),
          kind: 'account_created',
          data: {
            account: {
              id: expect.any(String),
              name: 'Wallet',
              type: 'cash',
              currency: 'USD',
              balanceMinor: 0,
            },
          },
        },
      ]);
      expect(await accountsOf(user)).toEqual([
        expect.objectContaining({ name: 'Wallet', type: 'cash', currency: 'USD' }),
      ]);
    });

    it('creates one card per item when a message contains several actions', async () => {
      const accounts = await sendOk(
        user,
        'Create a bank account called BCA in IDR and a cash account called Wallet in USD',
      );
      expect(kinds(accounts.assistantMessage.cards)).toEqual([
        'account_created',
        'account_created',
      ]);

      const body = await sendOk(
        user,
        'I spent 12.50 on Food from Wallet and I spent 4.80 on Coffee from Wallet; paid 1500000 on Rent from BCA',
      );
      const cards = body.assistantMessage.cards;
      expect(kinds(cards)).toEqual([
        'transaction_recorded',
        'transaction_recorded',
        'transaction_recorded',
      ]);
      expect(cards.map((c) => c.kind === 'transaction_recorded' && c.data.transaction)).toEqual([
        expect.objectContaining({
          accountName: 'Wallet',
          currency: 'USD',
          amountMinor: 1250,
          category: 'Food',
        }),
        expect.objectContaining({
          accountName: 'Wallet',
          currency: 'USD',
          amountMinor: 480,
          category: 'Coffee',
        }),
        expect.objectContaining({
          accountName: 'BCA',
          currency: 'IDR',
          amountMinor: 1500000,
          category: 'Rent',
        }),
      ]);

      const txs = (await get(user, '/transactions')).json() as Transaction[];
      expect(txs).toHaveLength(3);
    });

    it('lists one account’s transactions as a card with running balances', async () => {
      await sendOk(user, 'Create a cash account called Wallet in USD');
      await sendOk(user, 'got paid 250 into Wallet');
      await sendOk(user, 'I spent 12.50 on Food from Wallet');
      const today = new Date().toISOString().slice(0, 10);

      const body = await sendOk(user, `show transactions for Wallet from 2000-01-01 to ${today}`);
      const [card] = body.assistantMessage.cards;
      expect(card?.kind).toBe('transactions_listed');
      if (card?.kind !== 'transactions_listed') return;
      expect(card.data).toMatchObject({
        account: { name: 'Wallet', currency: 'USD' },
        from: '2000-01-01',
        to: today,
        openingBalanceMinor: 0,
        closingBalanceMinor: 23750,
      });
      expect(card.data.transactions.map((t) => t.runningBalanceMinor)).toEqual([25000, 23750]);
    });

    it('asks for the account and dates instead of listing transactions blindly', async () => {
      const body = await sendOk(user, 'Show my transactions');
      expect(body.assistantMessage.content).toMatch(/which account, and what date range/i);
      expect(body.assistantMessage.cards).toEqual([]);
    });

    it('summarises a requested month as a card, and asks when the month is missing', async () => {
      const asked = await sendOk(user, 'How did I do?');
      expect(asked.assistantMessage.content).toMatch(/which month and year/i);
      expect(asked.assistantMessage.cards).toEqual([]);

      const body = await sendOk(user, 'Summarise 2026-10');
      expect(body.assistantMessage.cards).toEqual([
        expect.objectContaining({
          kind: 'monthly_summary',
          data: { month: '2026-10', totals: [], byAccount: [], byCategory: [] },
        }),
      ]);
    });

    it('answers without tools or cards when no tool applies', async () => {
      const body = await sendOk(user, 'hello there');
      expect(body.assistantMessage.cards).toEqual([]);
      expect(body.assistantMessage.content).toMatch(/I can create accounts/);
    });

    it('does not create cards for failed tool calls', async () => {
      const body = await sendOk(user, 'I spent 5 on Food from Nowhere');
      expect(body.assistantMessage.cards).toEqual([]);
      expect(body.assistantMessage.content).toMatch(/Sorry/);
    });

    it('acts only on the logged-in user’s data', async () => {
      await sendOk(user, 'Create a bank account called Private in USD');
      const other = await registerUser(app);
      await sendOk(other, 'I spent 5 on Food from Private');
      expect(await accountsOf(other)).toEqual([]);
      expect((await get(user, '/transactions')).json()).toEqual([]);
    });

    it('validates the message and requires authentication', async () => {
      expect((await send(user, '   ')).statusCode).toBe(400);
      const anon = await app.inject({ method: 'POST', url: '/chat', payload: { message: 'hi' } });
      expect(anon.statusCode).toBe(401);
    });
  });

  describe('history', () => {
    it('persists every turn with its cards, oldest first', async () => {
      await sendOk(user, 'Create a cash account called Wallet in USD');
      await sendOk(user, 'hello');

      const page = (await get(user, '/chat/messages')).json() as ChatMessagesPage;
      expect(page.nextCursor).toBeNull();
      expect(page.messages.map((m) => [m.role, m.content.slice(0, 12)])).toEqual([
        ['user', 'Create a cas'],
        ['assistant', expect.any(String)],
        ['user', 'hello'],
        ['assistant', expect.any(String)],
      ]);
      expect(kinds(page.messages[1]!.cards)).toEqual(['account_created']);
    });

    it('paginates 20 messages at a time without gaps or duplicates', async () => {
      const { db, close } = createDb(TEST_DATABASE_URL, { max: 1 });
      try {
        for (let i = 1; i <= 23; i++) {
          await saveChatTurn(db, user.id, {
            userContent: `question ${i}`,
            assistantContent: `answer ${i}`,
            cards: [],
          });
        }
      } finally {
        await close();
      }

      const pages: ChatMessage[][] = [];
      let cursor: string | null = null;
      do {
        const query: string = cursor ? `?before=${cursor}` : '';
        const page = (await get(user, `/chat/messages${query}`)).json() as ChatMessagesPage;
        pages.push(page.messages);
        cursor = page.nextCursor;
      } while (cursor);

      expect(pages.map((p) => p.length)).toEqual([20, 20, 6]);
      // Newest page first; each page is oldest-first. Reassembled, it is the full conversation.
      const all = pages
        .reverse()
        .flat()
        .map((m) => m.content);
      const expected = Array.from({ length: 23 }, (_, i) => [
        `question ${i + 1}`,
        `answer ${i + 1}`,
      ]).flat();
      expect(all).toEqual(expected);
    });

    it('lists cards newest first with pagination', async () => {
      await sendOk(
        user,
        'Create a cash account called A in USD and a cash account called B in USD',
      );
      await sendOk(user, 'Create a cash account called C in USD');

      const first = (await get(user, '/chat/cards?limit=2')).json() as ChatCardsPage;
      const names = (cards: ChatCard[]) =>
        cards.map((c) => (c.kind === 'account_created' ? c.data.account.name : c.kind));
      expect(names(first.cards)).toEqual(['C', 'B']);
      expect(first.nextCursor).not.toBeNull();

      const second = (
        await get(user, `/chat/cards?limit=2&before=${first.nextCursor}`)
      ).json() as ChatCardsPage;
      expect(names(second.cards)).toEqual(['A']);
      expect(second.nextCursor).toBeNull();
    });

    it('keeps each user’s history and cards private', async () => {
      await sendOk(user, 'Create a cash account called Wallet in USD');
      const other = await registerUser(app);
      expect((await get(other, '/chat/messages')).json()).toEqual({
        messages: [],
        nextCursor: null,
      });
      expect((await get(other, '/chat/cards')).json()).toEqual({ cards: [], nextCursor: null });
    });

    it('rejects invalid cursors and requires authentication', async () => {
      expect((await get(user, '/chat/messages?before=abc')).statusCode).toBe(400);
      expect((await get(user, '/chat/cards?limit=0')).statusCode).toBe(400);
      expect((await app.inject({ method: 'GET', url: '/chat/messages' })).statusCode).toBe(401);
    });
  });

  describe('with a scripted LLM', () => {
    const withLlm = async (llm: LlmClient, overrides = {}) => {
      const scripted = await buildApp(testConfig({ MCP_URL: mcpUrl, ...overrides }), { llm });
      await scripted.ready();
      const who = await registerUser(scripted);
      const post = (message: string) =>
        scripted.inject({
          method: 'POST',
          url: '/chat',
          headers: { cookie: who.cookie },
          payload: { message },
        });
      return { scripted, who, post };
    };

    it('offers the MCP tools to Claude and sends tool results back with the matching id', async () => {
      const llm = new ScriptedLlm((_req, call) =>
        call === 1 ? toolUse('list_accounts', {}, 'toolu_1') : text('You have no accounts yet.'),
      );
      const { scripted, post } = await withLlm(llm);
      try {
        const res = await post('What accounts do I have?');
        // list_accounts is a lookup: it informs the reply but produces no card.
        expect((res.json() as ChatSendResponse).assistantMessage).toMatchObject({
          content: 'You have no accounts yet.',
          cards: [],
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

    it('sends previous turns from the database as context', async () => {
      const llm = new ScriptedLlm((req) => text(`seen ${req.messages.length} messages`));
      const { scripted, post } = await withLlm(llm);
      try {
        await post('first');
        const res = await post('second');
        expect((res.json() as ChatSendResponse).assistantMessage.content).toBe('seen 3 messages');
        expect(llm.requests[1]!.messages).toEqual([
          { role: 'user', content: 'first' },
          { role: 'assistant', content: 'seen 1 messages' },
          { role: 'user', content: 'second' },
        ]);
        expect(llm.requests[0]!.system).toMatch(/ask the user/i);
      } finally {
        await scripted.close();
      }
    });

    it(`stops after ${MAX_TOOL_ITERATIONS} tool iterations`, async () => {
      const llm = new ScriptedLlm((_req, call) => toolUse('list_accounts', {}, `toolu_${call}`));
      const { scripted, post } = await withLlm(llm);
      try {
        const body = (await post('loop forever')).json() as ChatSendResponse;
        expect(llm.requests).toHaveLength(MAX_TOOL_ITERATIONS);
        expect(body.assistantMessage.content).toMatch(/too many steps/);
      } finally {
        await scripted.close();
      }
    });

    it('handles a refusal', async () => {
      const llm = new ScriptedLlm(() => ({ stop_reason: 'refusal', content: [] }));
      const { scripted, post } = await withLlm(llm);
      try {
        const body = (await post('something disallowed')).json() as ChatSendResponse;
        expect(body.assistantMessage.content).toMatch(/can’t help/);
      } finally {
        await scripted.close();
      }
    });

    it('returns 502 when the LLM fails and saves nothing', async () => {
      const llm = new ScriptedLlm(() => {
        throw new Error('upstream down');
      });
      const { scripted, who, post } = await withLlm(llm);
      try {
        const res = await post('hi');
        expect(res.statusCode).toBe(502);
        expect(res.json()).toMatchObject({ error: 'AssistantUnavailable' });
        expect(res.body).not.toContain('upstream down');
        const history = await scripted.inject({
          method: 'GET',
          url: '/chat/messages',
          headers: { cookie: who.cookie },
        });
        expect(history.json()).toEqual({ messages: [], nextCursor: null });
      } finally {
        await scripted.close();
      }
    });

    it('keeps the turn and its cards when the LLM fails after a write tool ran', async () => {
      const llm = new ScriptedLlm((_req, call) => {
        if (call === 1) {
          return toolUse('create_account', { name: 'Wallet', type: 'cash', currency: 'USD' });
        }
        throw new Error('upstream down');
      });
      const { scripted, who, post } = await withLlm(llm);
      try {
        const res = await post('Create a cash account called Wallet in USD');
        expect(res.statusCode).toBe(200);
        const body = res.json() as ChatSendResponse;
        expect(body.assistantMessage.content).toMatch(/something went wrong/);
        expect(kinds(body.assistantMessage.cards)).toEqual(['account_created']);
        const history = await scripted.inject({
          method: 'GET',
          url: '/chat/messages',
          headers: { cookie: who.cookie },
        });
        expect((history.json() as ChatMessagesPage).messages).toHaveLength(2);
      } finally {
        await scripted.close();
      }
    });

    it('returns 502 when the MCP server is unreachable', async () => {
      const { scripted, post } = await withLlm(new ScriptedLlm(() => text('unused')), {
        MCP_URL: 'http://127.0.0.1:9/mcp',
      });
      try {
        expect((await post('hi')).statusCode).toBe(502);
      } finally {
        await scripted.close();
      }
    });
  });
});
