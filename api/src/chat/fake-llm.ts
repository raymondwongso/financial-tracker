import { randomUUID } from 'node:crypto';
import type Anthropic from '@anthropic-ai/sdk';
import type { LlmClient, LlmRequest, LlmResponse } from './llm';

/**
 * Deterministic stand-in for Claude used in tests, e2e runs and local demos without an API key
 * (LLM_PROVIDER=fake). It understands a few fixed phrasings and calls the matching MCP tool.
 */
export class FakeLlm implements LlmClient {
  async complete({ messages }: LlmRequest): Promise<LlmResponse> {
    const last = messages.at(-1);
    if (!last) return text('Hi! How can I help?');

    // Second leg: tool results came back, so summarise them.
    if (Array.isArray(last.content) && last.content.some((b) => b.type === 'tool_result')) {
      const results = last.content.filter(
        (b): b is Anthropic.ToolResultBlockParam => b.type === 'tool_result',
      );
      const failed = results.find((r) => r.is_error);
      if (failed) return text(`Sorry, that did not work: ${resultText(failed)}`);
      return text(`Done. ${results.map(resultText).join(' ')}`);
    }

    const prompt = typeof last.content === 'string' ? last.content : '';
    const intent = parseIntent(prompt);
    return intent ? toolUse(intent.name, intent.input) : text(HELP);
  }
}

const HELP =
  'I can create accounts, record income and expenses, list transactions and summarise a month.';

const ACCOUNT_TYPES: Record<string, string> = {
  cash: 'cash',
  bank: 'bank',
  'credit card': 'credit_card',
  'e-wallet': 'e_wallet',
  ewallet: 'e_wallet',
  investment: 'investment',
};

function parseIntent(prompt: string): { name: string; input: Record<string, unknown> } | undefined {
  const p = prompt.trim();
  let m = p.match(
    /create (?:an? )?(cash|bank|credit card|e-?wallet|investment)? ?account (?:called|named) (.+?)(?: in ([a-z]{3}))?$/i,
  );
  if (m) {
    return {
      name: 'create_account',
      input: {
        name: m[2]!.trim(),
        type: ACCOUNT_TYPES[(m[1] ?? 'bank').toLowerCase()] ?? 'bank',
        currency: (m[3] ?? 'USD').toUpperCase(),
      },
    };
  }
  m = p.match(/(?:spent|paid) ([\d.]+) on (\w+) (?:from|with) (.+)$/i);
  if (m) {
    return {
      name: 'create_transaction',
      input: { account: m[3]!.trim(), type: 'expense', amount: Number(m[1]), category: m[2] },
    };
  }
  m = p.match(/(?:got paid|received|earned) ([\d.]+) (?:into|in|to) (.+)$/i);
  if (m) {
    return {
      name: 'create_transaction',
      input: { account: m[2]!.trim(), type: 'income', amount: Number(m[1]), category: 'Income' },
    };
  }
  if (/summar|how did i do/i.test(p)) {
    const month = p.match(/\d{4}-\d{2}/)?.[0];
    return { name: 'monthly_summary', input: month ? { month } : {} };
  }
  if (/transactions/i.test(p)) return { name: 'list_transactions', input: {} };
  if (/accounts/i.test(p)) return { name: 'list_accounts', input: {} };
  return undefined;
}

function resultText(block: Anthropic.ToolResultBlockParam): string {
  if (typeof block.content === 'string') return block.content;
  return (block.content ?? [])
    .map((c) => (c.type === 'text' ? c.text : ''))
    .join(' ')
    .trim();
}

function text(value: string): LlmResponse {
  return { stop_reason: 'end_turn', content: [{ type: 'text', text: value, citations: null }] };
}

function toolUse(name: string, input: Record<string, unknown>): LlmResponse {
  return {
    stop_reason: 'tool_use',
    content: [{ type: 'tool_use', id: `toolu_${randomUUID()}`, name, input }],
  } as LlmResponse;
}
