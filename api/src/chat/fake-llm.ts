import { randomUUID } from 'node:crypto';
import type Anthropic from '@anthropic-ai/sdk';
import type { LlmClient, LlmRequest, LlmResponse } from './llm';

/**
 * Deterministic stand-in for Claude used in tests, e2e runs and local demos without an API key
 * (LLM_PROVIDER=fake). It understands a few fixed phrasings, can handle several requests joined
 * with "and" / ";" / ". " in one message, and asks for missing details like the real assistant.
 *
 * Supported phrasings:
 * - "create a cash account called Wallet in USD"
 * - "I spent 12.50 on Food from Wallet" / "got paid 5000 into Bank"
 * - "show transactions for Wallet from 2026-10-01 to 2026-10-31"
 * - "summarise 2026-10"
 */
export class FakeLlm implements LlmClient {
  async complete({ messages }: LlmRequest): Promise<LlmResponse> {
    const last = messages.at(-1);
    if (!last) return text(HELP);

    // Second leg: tool results came back, so summarise them.
    if (Array.isArray(last.content) && last.content.some((b) => b.type === 'tool_result')) {
      const results = last.content.filter(
        (b): b is Anthropic.ToolResultBlockParam => b.type === 'tool_result',
      );
      return text(
        results
          .map((r) =>
            r.is_error ? `Sorry, that did not work: ${resultText(r)}` : describe(resultText(r)),
          )
          .join(' '),
      );
    }

    const prompt = typeof last.content === 'string' ? last.content : '';
    const intents = prompt
      .split(/\s+and\s+|;|\.\s+/i)
      .map((clause) => parseIntent(clause.trim()))
      .filter((i): i is Intent => i !== undefined);

    const question = intents.find((i) => i.kind === 'ask');
    if (question?.kind === 'ask') return text(question.question);
    const tools = intents.filter((i): i is ToolIntent => i.kind === 'tool');
    return tools.length ? toolUse(tools) : text(HELP);
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

interface ToolIntent {
  kind: 'tool';
  name: string;
  input: Record<string, unknown>;
}
type Intent = ToolIntent | { kind: 'ask'; question: string };

const DATE = '(\\d{4}-\\d{2}-\\d{2})';

function parseIntent(clause: string): Intent | undefined {
  let m = clause.match(
    /(?:create )?(?:an? )?(cash|bank|credit card|e-?wallet|investment)? ?account (?:called|named) (.+?)(?: in ([a-z]{3}))?\.?$/i,
  );
  if (m) {
    return tool('create_account', {
      name: m[2]!.trim(),
      type: ACCOUNT_TYPES[(m[1] ?? 'bank').toLowerCase()] ?? 'bank',
      currency: (m[3] ?? 'USD').toUpperCase(),
    });
  }
  m = clause.match(/(?:spent|paid) ([\d.]+) on (\w+) (?:from|with) (.+?)\.?$/i);
  if (m) {
    return tool('create_transaction', {
      account: m[3]!.trim(),
      type: 'expense',
      amount: Number(m[1]),
      category: m[2],
      description: m[2],
    });
  }
  m = clause.match(/(?:got paid|received|earned) ([\d.]+) (?:into|in|to) (.+?)\.?$/i);
  if (m) {
    return tool('create_transaction', {
      account: m[2]!.trim(),
      type: 'income',
      amount: Number(m[1]),
      category: 'Income',
    });
  }
  if (/transactions/i.test(clause)) {
    m = clause.match(new RegExp(`transactions (?:for|in|of) (.+?) from ${DATE} to ${DATE}`, 'i'));
    return m
      ? tool('list_transactions', { account: m[1]!.trim(), startDate: m[2], endDate: m[3] })
      : { kind: 'ask', question: 'Sure — which account, and what date range?' };
  }
  if (/summar|how did i do/i.test(clause)) {
    const month = clause.match(/\d{4}-\d{2}/)?.[0];
    return month
      ? tool('monthly_summary', { month })
      : { kind: 'ask', question: 'Which month and year should I summarise?' };
  }
  if (/accounts/i.test(clause)) return tool('list_accounts', {});
  return undefined;
}

const tool = (name: string, input: Record<string, unknown>): ToolIntent => ({
  kind: 'tool',
  name,
  input,
});

/** Turns a tool's JSON text result into a one-line human reply. */
function describe(raw: string): string {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return raw;
  }
  if (Array.isArray(data)) return `You have ${data.length} account${data.length === 1 ? '' : 's'}.`;
  const d = data as Record<string, unknown>;
  if (typeof d.created === 'string') return `Created ${d.type} account "${d.created}".`;
  if (typeof d.recorded === 'string') {
    return `Recorded ${d.recorded} of ${d.amount} for ${d.category} on ${d.account}.`;
  }
  if (Array.isArray(d.transactions)) {
    return `Here are ${d.account}'s ${d.transactions.length} transactions from ${d.from} to ${d.to}.`;
  }
  if (Array.isArray(d.totals)) {
    const totals = d.totals as Array<Record<string, string>>;
    if (totals.length === 0) return `No transactions in ${d.month}.`;
    return `In ${d.month}: ${totals.map((t) => `income ${t.income}, expenses ${t.expense}, net ${t.net}`).join('; ')}.`;
  }
  return 'Done.';
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

function toolUse(intents: ToolIntent[]): LlmResponse {
  return {
    stop_reason: 'tool_use',
    content: intents.map((i) => ({
      type: 'tool_use',
      id: `toolu_${randomUUID()}`,
      name: i.name,
      input: i.input,
    })),
  } as LlmResponse;
}
