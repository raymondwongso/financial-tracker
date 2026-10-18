import { and, asc, desc, eq, getTableColumns, gte, lt, lte, sql, type SQL } from 'drizzle-orm';
import type {
  AccountStatement,
  CreateTransactionInput,
  ListTransactionsQuery,
  Transaction,
} from '../../schemas/transaction';
import { monthRange } from '../../money';
import type { Db } from '../client';
import { accounts, transactions, type TransactionRow } from '../schema';

const MAX_ROWS = 500;

function toTransaction(row: TransactionRow): Transaction {
  return {
    id: row.id,
    accountId: row.accountId,
    type: row.type,
    amountMinor: row.amountMinor,
    category: row.category,
    description: row.description,
    occurredOn: row.occurredOn,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Returns `undefined` when the account does not exist or belongs to another user. */
export async function createTransaction(
  db: Db,
  userId: string,
  input: CreateTransactionInput,
): Promise<Transaction | undefined> {
  const account = await db.query.accounts.findFirst({
    columns: { id: true },
    where: and(eq(accounts.id, input.accountId), eq(accounts.userId, userId)),
  });
  if (!account) return undefined;

  const [row] = await db
    .insert(transactions)
    .values({ ...input, description: input.description || null, userId })
    .returning();
  return toTransaction(row!);
}

export async function listTransactions(
  db: Db,
  userId: string,
  query: ListTransactionsQuery = {},
): Promise<Transaction[]> {
  const filters: SQL[] = [eq(transactions.userId, userId)];
  if (query.accountId) filters.push(eq(transactions.accountId, query.accountId));
  if (query.month) {
    const { start, end } = monthRange(query.month);
    filters.push(gte(transactions.occurredOn, start), lt(transactions.occurredOn, end));
  }
  if (query.from && query.to) {
    filters.push(gte(transactions.occurredOn, query.from), lte(transactions.occurredOn, query.to));
  }

  const rows = await db
    .select()
    .from(transactions)
    .where(and(...filters))
    .orderBy(desc(transactions.occurredOn), desc(transactions.createdAt))
    .limit(MAX_ROWS);
  return rows.map(toTransaction);
}

/** +amount for income, -amount for expense. */
const signedAmount = sql<number>`case when ${transactions.type} = 'income'
  then ${transactions.amountMinor} else -${transactions.amountMinor} end`;

/**
 * One account's transactions in an inclusive date range, oldest first, each with the account
 * balance right after it. The opening balance is everything recorded before `from`, so running
 * balances always agree with the account balance. `undefined` if the account is not the user's.
 */
export async function accountStatement(
  db: Db,
  userId: string,
  accountId: string,
  from: string,
  to: string,
): Promise<AccountStatement | undefined> {
  const account = await db.query.accounts.findFirst({
    columns: { id: true, name: true, type: true, currency: true },
    where: and(eq(accounts.id, accountId), eq(accounts.userId, userId)),
  });
  if (!account) return undefined;

  const ofAccount = and(eq(transactions.userId, userId), eq(transactions.accountId, accountId));
  const [opening] = await db
    .select({ total: sql<number>`coalesce(sum(${signedAmount}), 0)`.mapWith(Number) })
    .from(transactions)
    .where(and(ofAccount, lt(transactions.occurredOn, from)));
  const openingBalanceMinor = opening?.total ?? 0;

  const order = [asc(transactions.occurredOn), asc(transactions.createdAt), asc(transactions.id)];
  const rows = await db
    .select({
      ...getTableColumns(transactions),
      cumulative: sql<number>`sum(${signedAmount}) over (
        order by ${transactions.occurredOn}, ${transactions.createdAt}, ${transactions.id})`.mapWith(
        Number,
      ),
    })
    .from(transactions)
    .where(and(ofAccount, gte(transactions.occurredOn, from), lte(transactions.occurredOn, to)))
    .orderBy(...order)
    .limit(MAX_ROWS);

  const statementRows = rows.map(({ cumulative, ...row }) => ({
    ...toTransaction(row),
    runningBalanceMinor: openingBalanceMinor + cumulative,
  }));
  return {
    account,
    from,
    to,
    openingBalanceMinor,
    closingBalanceMinor: statementRows.at(-1)?.runningBalanceMinor ?? openingBalanceMinor,
    transactions: statementRows,
  };
}
