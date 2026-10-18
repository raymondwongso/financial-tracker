import { and, desc, eq, gte, lt, type SQL } from 'drizzle-orm';
import type {
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

  const rows = await db
    .select()
    .from(transactions)
    .where(and(...filters))
    .orderBy(desc(transactions.occurredOn), desc(transactions.createdAt))
    .limit(MAX_ROWS);
  return rows.map(toTransaction);
}
