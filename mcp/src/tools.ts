import {
  accountCreatedDataSchema,
  accountsListedDataSchema,
  accountTypeSchema,
  currencySchema,
  dateSchema,
  formatMoney,
  monthlySummaryDataSchema,
  monthSchema,
  toMinor,
  transactionRecordedDataSchema,
  transactionsListedDataSchema,
  transactionTypeSchema,
  type Account,
  type AccountCreatedData,
  type AccountsListedData,
  type MonthlySummaryData,
  type TransactionRecordedData,
  type TransactionsListedData,
} from '@ft/shared';
import {
  accountStatement,
  ConflictError,
  createAccount,
  createTransaction,
  findAccountByName,
  getAccount,
  listAccounts,
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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class ToolError extends Error {}

/**
 * Every successful tool returns two views of the same result:
 * - `structuredContent`: raw snapshot data (minor units) that the API stores as a chat card;
 * - text: a compact, human-readable rendering for the LLM to phrase its reply from.
 */
interface ToolOutput<T> {
  data: T;
  text: unknown;
}

const fail = (message: string): CallToolResult => ({
  isError: true,
  content: [{ type: 'text', text: message }],
});

const money = (minor: number, currency: string, signed = false) =>
  formatMoney(minor, currency, { signed });

const today = () => new Date().toISOString().slice(0, 10);

/** Builds an MCP server whose tools are bound to one user. Created per request (stateless transport). */
export function createMcpServer(ctx: ToolContext): McpServer {
  const server = new McpServer({ name: 'financial-tracker', version: '0.2.0' });
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

  // Wraps a handler with uniform result shaping, error handling and metrics.
  function tool<Args, T extends Record<string, unknown>>(
    name: string,
    handler: (args: Args) => Promise<ToolOutput<T>>,
  ) {
    return async (args: Args): Promise<CallToolResult> => {
      try {
        const { data, text } = await handler(args);
        ctx.onToolCall?.(name, 'ok');
        return {
          structuredContent: data,
          content: [{ type: 'text', text: JSON.stringify(text, null, 2) }],
        };
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
        "List the user's financial accounts with their type, currency and current balance. " +
        'Use it to find the right account name before other tools.',
      inputSchema: z.object({}),
      outputSchema: accountsListedDataSchema,
    },
    tool('list_accounts', async (): Promise<ToolOutput<AccountsListedData>> => {
      const accounts = await listAccounts(db, userId);
      return {
        data: { accounts },
        text: accounts.map((a) => ({
          name: a.name,
          type: a.type,
          currency: a.currency,
          balance: money(a.balanceMinor, a.currency),
        })),
      };
    }),
  );

  server.registerTool(
    'create_account',
    {
      title: 'Create account',
      description:
        'Create a financial account (bank account, cash wallet, credit card, e-wallet or investment). ' +
        'Account names are unique per user (case-insensitive). Call once per account.',
      inputSchema: z.object({
        name: z.string().trim().min(1).max(100).describe('Display name, e.g. "BCA Savings"'),
        type: accountTypeSchema.describe('Kind of account'),
        currency: currencySchema.describe('ISO 4217 code such as USD, IDR, EUR'),
      }),
      outputSchema: accountCreatedDataSchema,
    },
    tool(
      'create_account',
      async (args: {
        name: string;
        type: Account['type'];
        currency: string;
      }): Promise<ToolOutput<AccountCreatedData>> => {
        const a = await createAccount(db, userId, args);
        const account = {
          id: a.id,
          name: a.name,
          type: a.type,
          currency: a.currency,
          balanceMinor: a.balanceMinor,
        };
        return {
          data: { account },
          text: {
            created: a.name,
            type: a.type,
            currency: a.currency,
            balance: money(0, a.currency),
          },
        };
      },
    ),
  );

  server.registerTool(
    'create_transaction',
    {
      title: 'Record transaction',
      description:
        "Record ONE income or expense on one of the user's accounts; call it once per transaction " +
        '(several calls for several transactions). "amount" is in major units (e.g. 12.50 dollars) ' +
        'and always positive; "type" says whether money came in or went out.',
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
        description: z.string().trim().max(255).optional().describe('What it was, e.g. "Lunch"'),
        occurredOn: dateSchema.optional().describe('YYYY-MM-DD; defaults to today'),
      }),
      outputSchema: transactionRecordedDataSchema,
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
      }): Promise<ToolOutput<TransactionRecordedData>> => {
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
        const signed = tx.type === 'income' ? tx.amountMinor : -tx.amountMinor;
        return {
          data: {
            transaction: {
              id: tx.id,
              accountId: account.id,
              accountName: account.name,
              currency: account.currency,
              type: tx.type,
              amountMinor: tx.amountMinor,
              category: tx.category,
              description: tx.description,
              occurredOn: tx.occurredOn,
            },
          },
          text: {
            recorded: tx.type,
            account: account.name,
            amount: money(signed, account.currency, true),
            category: tx.category,
            description: tx.description,
            occurredOn: tx.occurredOn,
          },
        };
      },
    ),
  );

  server.registerTool(
    'list_transactions',
    {
      title: 'List transactions',
      description:
        "List one account's transactions in a date range, oldest first, with the running balance " +
        'after each one. All three arguments are required: if the user did not say which account ' +
        'or which dates, ask them first instead of guessing.',
      inputSchema: z.object({
        account: z.string().min(1).describe('Account name or id'),
        startDate: dateSchema.describe('First day, YYYY-MM-DD (inclusive)'),
        endDate: dateSchema.describe('Last day, YYYY-MM-DD (inclusive)'),
      }),
      outputSchema: transactionsListedDataSchema,
    },
    tool(
      'list_transactions',
      async (args: {
        account: string;
        startDate: string;
        endDate: string;
      }): Promise<ToolOutput<TransactionsListedData>> => {
        if (args.startDate > args.endDate) {
          throw new ToolError('startDate must be on or before endDate.');
        }
        const account = await resolveAccount(args.account);
        const statement = await accountStatement(
          db,
          userId,
          account.id,
          args.startDate,
          args.endDate,
        );
        if (!statement) throw new ToolError('Account not found.');
        const c = account.currency;
        return {
          data: statement,
          text: {
            account: account.name,
            from: statement.from,
            to: statement.to,
            openingBalance: money(statement.openingBalanceMinor, c),
            closingBalance: money(statement.closingBalanceMinor, c),
            transactions: statement.transactions.map((t) => ({
              occurredOn: t.occurredOn,
              type: t.type,
              amount: money(t.type === 'income' ? t.amountMinor : -t.amountMinor, c, true),
              category: t.category,
              description: t.description,
              balanceAfter: money(t.runningBalanceMinor, c),
            })),
          },
        };
      },
    ),
  );

  server.registerTool(
    'monthly_summary',
    {
      title: 'Monthly summary',
      description:
        'Summarise income, expenses and net for one month across all accounts (per currency, per ' +
        'account and per category). The month is required: if the user did not say which month ' +
        'and year, ask them first instead of guessing.',
      inputSchema: z.object({ month: monthSchema.describe('YYYY-MM, e.g. 2026-10') }),
      outputSchema: monthlySummaryDataSchema,
    },
    tool(
      'monthly_summary',
      async (args: { month: string }): Promise<ToolOutput<MonthlySummaryData>> => {
        const s = await monthlySummary(db, userId, args.month);
        return {
          data: s,
          text: {
            month: s.month,
            totals: s.totals.map((t) => ({
              currency: t.currency,
              income: money(t.incomeMinor, t.currency),
              expense: money(t.expenseMinor, t.currency),
              net: money(t.netMinor, t.currency, true),
            })),
            byAccount: s.byAccount.map((a) => ({
              account: a.accountName,
              income: money(a.incomeMinor, a.currency),
              expense: money(a.expenseMinor, a.currency),
              net: money(a.netMinor, a.currency, true),
            })),
            byCategory: s.byCategory.map((c) => ({
              category: c.category,
              type: c.type,
              total: money(c.totalMinor, c.currency),
            })),
          },
        };
      },
    ),
  );

  return server;
}
