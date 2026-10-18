import type Anthropic from '@anthropic-ai/sdk';
import type { ChatSendResponse } from '@ft/shared';
import { recentChatHistory, saveChatTurn, type Db, type NewChatCard } from '@ft/shared/db';
import type { FastifyBaseLogger } from 'fastify';
import { cardFromToolResult } from './cards';
import type { LlmClient } from './llm';
import type { McpGateway } from './mcp-gateway';

export const MAX_TOOL_ITERATIONS = 5;
/** Previous messages sent to Claude as context. */
export const CONTEXT_MESSAGES = 20;

const systemPrompt = (today: string) =>
  [
    'You are the assistant inside Financial Tracker, a personal finance app.',
    `Today is ${today}.`,
    'Use the provided tools to read and change the user’s accounts and transactions; never invent data.',
    'Call create_account once per account and create_transaction once per transaction, even when one message mentions several.',
    'Amounts given to tools are in major units (12.50 means twelve dollars fifty).',
    'If the account for a transaction is unclear, check list_accounts or ask the user.',
    'Before listing transactions you need the account, a start date and an end date; before a monthly summary you need the month and year. If any of these is missing, ask the user for it and do not call the tool.',
    'The app shows each result as a card, so reply in one or two short sentences of plain text instead of repeating every detail.',
  ].join(' ');

/** Runs one chat turn: Claude chooses MCP tools, we execute them, then the turn is saved with its cards. */
export class ChatService {
  constructor(
    private readonly db: Db,
    private readonly llm: LlmClient,
    private readonly mcp: McpGateway,
  ) {}

  async send(userId: string, message: string, log: FastifyBaseLogger): Promise<ChatSendResponse> {
    const history = await recentChatHistory(this.db, userId, CONTEXT_MESSAGES);
    // Claude requires the conversation to start with a user turn.
    while (history[0]?.role === 'assistant') history.shift();
    const messages: Anthropic.MessageParam[] = [...history, { role: 'user', content: message }];

    const cards: NewChatCard[] = [];
    let reply: string;
    try {
      reply = await this.run(userId, messages, cards, log);
    } catch (error) {
      // Tools that already ran have changed data; keep the turn so the user sees what happened
      // (and doesn't retry into duplicates). With nothing done yet, report the failure instead.
      if (cards.length === 0) throw error;
      log.error({ err: error }, 'chat turn failed after tool calls; saving partial result');
      reply =
        'I completed the actions shown below, but then something went wrong before I could finish. ' +
        'Please check them before trying again.';
    }
    return saveChatTurn(this.db, userId, {
      userContent: message,
      assistantContent: reply,
      cards,
    });
  }

  /** Runs the tool loop, pushing a card for each successful tool call into `cards` as it goes. */
  private async run(
    userId: string,
    messages: Anthropic.MessageParam[],
    cards: NewChatCard[],
    log: FastifyBaseLogger,
  ): Promise<string> {
    const session = await this.mcp.open(userId);
    const system = systemPrompt(new Date().toISOString().slice(0, 10));

    try {
      for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
        const response = await this.llm.complete({ system, messages, tools: session.tools });

        if (response.stop_reason === 'refusal') {
          return 'Sorry, I can’t help with that request.';
        }

        const uses = response.content.filter(
          (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
        );
        if (response.stop_reason !== 'tool_use' || uses.length === 0) {
          const reply = response.content
            .filter((b): b is Anthropic.TextBlock => b.type === 'text')
            .map((b) => b.text)
            .join('\n')
            .trim();
          return reply || 'Done.';
        }

        // Keep the full assistant content (including thinking blocks) so the next request is valid.
        messages.push({ role: 'assistant', content: response.content });
        const results: Anthropic.ToolResultBlockParam[] = [];
        for (const use of uses) {
          const input = (use.input ?? {}) as Record<string, unknown>;
          const result = await session.callTool(use.name, input);
          log.info({ tool: use.name, isError: result.isError }, 'chat tool call');
          const card = cardFromToolResult(use.name, result);
          if (card) cards.push(card);
          results.push({
            type: 'tool_result',
            tool_use_id: use.id,
            content: result.text,
            is_error: result.isError,
          });
        }
        // All results for one assistant turn go back in a single user message.
        messages.push({ role: 'user', content: results });
      }
      return 'Sorry, that took too many steps. Please try a simpler request.';
    } finally {
      await session.close();
    }
  }
}
