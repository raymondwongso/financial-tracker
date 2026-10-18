import type Anthropic from '@anthropic-ai/sdk';
import type { ChatMessage, ChatResponse, ChatToolCall } from '@ft/shared';
import type { FastifyBaseLogger } from 'fastify';
import type { LlmClient } from './llm';
import type { McpGateway } from './mcp-gateway';

export const MAX_TOOL_ITERATIONS = 5;

const systemPrompt = (today: string) =>
  [
    'You are the assistant inside Financial Tracker, a personal finance app.',
    `Today is ${today}.`,
    'Use the provided tools to read and change the user’s accounts and transactions; never invent data.',
    'Amounts given to tools are in major units (12.50 means twelve dollars fifty).',
    'If the account for a transaction is unclear, check list_accounts or ask the user.',
    'Reply in one to three short sentences of plain text and mention the amounts involved.',
  ].join(' ');

/** Runs one chat turn: Claude chooses MCP tools, we execute them, until Claude answers in text. */
export class ChatService {
  constructor(
    private readonly llm: LlmClient,
    private readonly mcp: McpGateway,
  ) {}

  async reply(
    userId: string,
    history: ChatMessage[],
    log: FastifyBaseLogger,
  ): Promise<ChatResponse> {
    const session = await this.mcp.open(userId);
    const toolCalls: ChatToolCall[] = [];
    const messages: Anthropic.MessageParam[] = history.map((m) => ({
      role: m.role,
      content: m.content,
    }));
    const system = systemPrompt(new Date().toISOString().slice(0, 10));

    try {
      for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
        const response = await this.llm.complete({ system, messages, tools: session.tools });

        if (response.stop_reason === 'refusal') {
          return { reply: 'Sorry, I can’t help with that request.', toolCalls };
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
          return { reply: reply || 'Done.', toolCalls };
        }

        // Keep the full assistant content (including thinking blocks) so the next request is valid.
        messages.push({ role: 'assistant', content: response.content });
        const results: Anthropic.ToolResultBlockParam[] = [];
        for (const use of uses) {
          const input = (use.input ?? {}) as Record<string, unknown>;
          const result = await session.callTool(use.name, input);
          log.info({ tool: use.name, isError: result.isError }, 'chat tool call');
          toolCalls.push({ name: use.name, input, isError: result.isError });
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
      return {
        reply: 'Sorry, that took too many steps. Please try a simpler request.',
        toolCalls,
      };
    } finally {
      await session.close();
    }
  }
}
