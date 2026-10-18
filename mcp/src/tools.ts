import {
  accountTypeSchema,
  currencySchema,
  currentMonth,
  dateSchema,
  formatMoney,
  monthSchema,
  toMinor,
  transactionTypeSchema,
  type Account,
} from '@ft/shared';
import {
  ConflictError,
  createAccount,
  createTransaction,
  findAccountByName,
  getAccount,
  listAccounts,
  listTransactions,
  monthlySummary,
  type Db,
} from '@ft/shared/db';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

export interface ToolContext {
  db: Db;
  /** Owner of every read and write; comes from the verified internal token, never from tool input. */
  userId: string;
  onToolCall?: (tool: string, outcome: 'ok' | 'error') => void;
}

const MAX_LISTED_TRANSACTIONS = 50;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class ToolError extends Error {}

const ok = (data: unknown): CallToolResult => ({
  content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
});
const fail = (message: string): CallToolResult => ({
  isError: true,
  content: [{ type: 'text', text: message }],
});

const presentAccount = (a: Account) => ({
  id: a.id,
  name: a.name,
  type: a.type,
  currency: a.currency,
  balance: formatMoney(a.balanceMinor, a.currency),
});

const today = () => new Date().toISOString().slice(0, 10);

/** Builds an MCP server whose tools are bound to one user. Created per request (stateless transport). */
export function createMcpServer(ctx: ToolContext): McpServer {
  const server = new McpServer({ name: 'financial-tracker', version: '0.1.0' });
  const { db, userId } = ctx;

  async function resolveAccount(ref: string): Promise<Account> {
    const account = UUID.test(ref)
      ? await getAccount(db, userId, ref)
      : await findAccountByName(db, userId, ref);
    if (!account) {
      const names = (await listAccounts(db, userId)).map((a) => a.name);
      throw new ToolError(
        `No account named "${ref}". Existing accounts: ${names.length ? names.join(', ') : 'none'}.`,
      );
    }
    return account;
  }

  // Wraps a handler with uniform error handling and metrics.
  function tool<Args>(name: string, handler: (args: Args) => Promise<unknown>) {
    return async (args: Args): Promise<CallToolResult> => {
      try {
        const result = ok(await handler(args));
        ctx.onToolCall?.(name, 'ok');
        return result;
      } catch (error) {
        ctx.onToolCall?.(name, 'error');
        if (error instanceof ToolError || error instanceof ConflictError)
          return fail(error.message);
        throw error;
      }
    };
  }

  server.registerTool(
    'list_accounts',
    {
      title: 'List accounts',
      description:
        "List the user's financial accounts with their type, currency and current balance.",
      inputSchema: z.object({}),
    },
    tool('list_accounts', async () => (await listAccounts(db, userId)).map(presentAccount)),
  );

  server.registerTool(
    'create_account',
    {
      title: 'Create account',
      description:
        'Create a financial account (bank account, cash wallet, credit card, e-wallet or investment). ' +
        'Account names are unique per user (case-insensitive).',
      inputSchema: z.object({
        name: z.string().trim().min(1).max(100).describe('Display name, e.g. "BCA Savings"'),
        type: accountTypeSchema.describe('Kind of account'),
        currency: currencySchema.describe('ISO 4217 code such as USD, IDR, EUR'),
      }),
    },
    tool(
      'create_account',
      async (args: { name: string; type: Account['type']; currency: string }) =>
        presentAccount(await createAccount(db, userId, args)),
    ),
  );

  server.registerTool(
    'create_transaction',
    {
      title: 'Record transaction',
      description:
        'Record an income or expense on one of the user\'s accounts. "amount" is in major units ' +
        '(e.g. 12.50 dollars) and is always positive; "type" says whether money came in or went out.',
      inputSchema: z.object({
        account: z.string().min(1).describe('Account name (or id) as returned by list_accounts'),
        type: transactionTypeSchema,
        amount: z.number().positive().describe('Positive amount in major units, e.g. 12.5'),
        category: z
          .string()
          .trim()
          .min(1)
          .max(50)
          .describe('Short category, e.g. Food, Rent, Salary'),
        description: z.string().trim().max(255).optional(),
        occurredOn: dateSchema.optional().describe('YYYY-MM-DD; defaults to today'),
      }),
    },
    tool(
      'create_transaction',
      async (args: {
        account: string;
        type: 'income' | 'expense';
        amount: number;
        category: string;
        description?: string;
        occurredOn?: string;
      }) => {
        const account = await resolveAccount(args.account);
        const amountMinor = toMinor(args.amount, account.currency);
        if (amountMinor <= 0) throw new ToolError('Amount is too small for this currency.');
        const tx = await createTransaction(db, userId, {
          accountId: account.id,
          type: args.type,
          amountMinor,
          category: args.category,
          description: args.description,
          occurredOn: args.occurredOn ?? today(),
        });
        if (!tx) throw new ToolError('Account not found.');
        return {
          id: tx.id,
          account: account.name,
          type: tx.type,
          amount: formatMoney(tx.amountMinor, account.currency),
          category: tx.category,
          description: tx.description,
          occurredOn: tx.occurredOn,
        };
      },
    ),
  );

  server.registerTool(
    'list_transactions',
    {
      title: 'List transactions',
      description: `List the user's most recent transactions (up to ${MAX_LISTED_TRANSACTIONS}), optionally for one account and/or month.`,
      inputSchema: z.object({
        account: z.string().min(1).optional().describe('Account name or id'),
        month: monthSchema.optional().describe('YYYY-MM'),
      }),
    },
    tool('list_transactions', async (args: { account?: string; month?: string }) => {
      const account = args.account ? await resolveAccount(args.account) : undefined;
      const accounts = new Map((await listAccounts(db, userId)).map((a) => [a.id, a]));
      const rows = await listTransactions(db, userId, {
        accountId: account?.id,
        month: args.month,
      });
      return rows.slice(0, MAX_LISTED_TRANSACTIONS).map((t) => {
        const acc = accounts.get(t.accountId);
        return {
          occurredOn: t.occurredOn,
          account: acc?.name,
          type: t.type,
          amount: formatMoney(t.amountMinor, acc?.currency ?? 'USD'),
          category: t.category,
          description: t.description,
        };
      });
    }),
  );

  server.registerTool(
    'monthly_summary',
    {
      title: 'Monthly summary',
      description:
        'Summarise income, expenses and net for a month, per currency, per account and per category.',
      inputSchema: z.object({
        month: monthSchema.optional().describe('YYYY-MM; defaults to the current month'),
      }),
    },
    tool('monthly_summary', async (args: { month?: string }) => {
      const s = await monthlySummary(db, userId, args.month ?? currentMonth());
      const money = (minor: number, currency: string) => formatMoney(minor, currency);
      return {
        month: s.month,
        totals: s.totals.map((t) => ({
          currency: t.currency,
          income: money(t.incomeMinor, t.currency),
          expense: money(t.expenseMinor, t.currency),
          net: money(t.netMinor, t.currency),
        })),
        byAccount: s.byAccount.map((a) => ({
          account: a.accountName,
          income: money(a.incomeMinor, a.currency),
          expense: money(a.expenseMinor, a.currency),
          net: money(a.netMinor, a.currency),
        })),
        byCategory: s.byCategory.map((c) => ({
          category: c.category,
          type: c.type,
          total: money(c.totalMinor, c.currency),
        })),
      };
    }),
  );

  return server;
}
