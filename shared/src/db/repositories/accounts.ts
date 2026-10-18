import { and, asc, eq, sql } from 'drizzle-orm';
import type { Account, CreateAccountInput } from '../../schemas/account';
import type { Db } from '../client';
import { ConflictError, isUniqueViolation } from '../errors';
import { accounts, transactions } from '../schema';

const balanceMinor = sql<number>`coalesce(sum(case when ${transactions.type} = 'income'
  then ${transactions.amountMinor} else -${transactions.amountMinor} end), 0)`.mapWith(Number);

function selectAccounts(db: Db) {
  return db
    .select({
      id: accounts.id,
      name: accounts.name,
      type: accounts.type,
      currency: accounts.currency,
      balanceMinor,
      createdAt: accounts.createdAt,
    })
    .from(accounts)
    .leftJoin(transactions, eq(transactions.accountId, accounts.id))
    .groupBy(accounts.id);
}

type AccountSelect = Awaited<ReturnType<typeof selectAccounts>>[number];

const toAccount = (row: AccountSelect): Account => ({
  id: row.id,
  name: row.name,
  type: row.type,
  currency: row.currency,
  balanceMinor: row.balanceMinor,
  createdAt: row.createdAt.toISOString(),
});

export async function createAccount(
  db: Db,
  userId: string,
  input: CreateAccountInput,
): Promise<Account> {
  try {
    const [row] = await db
      .insert(accounts)
      .values({ ...input, userId })
      .returning();
    return toAccount({ ...row!, balanceMinor: 0 });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConflictError(`An account named "${input.name}" already exists`);
    }
    throw error;
  }
}

export async function listAccounts(db: Db, userId: string): Promise<Account[]> {
  const rows = await selectAccounts(db)
    .where(eq(accounts.userId, userId))
    .orderBy(asc(accounts.createdAt), asc(accounts.name));
  return rows.map(toAccount);
}

export async function getAccount(
  db: Db,
  userId: string,
  accountId: string,
): Promise<Account | undefined> {
  const [row] = await selectAccounts(db).where(
    and(eq(accounts.userId, userId), eq(accounts.id, accountId)),
  );
  return row ? toAccount(row) : undefined;
}

/** Case-insensitive lookup by name; used by the chat tools ("add 20 to my BCA account"). */
export async function findAccountByName(
  db: Db,
  userId: string,
  name: string,
): Promise<Account | undefined> {
  const [row] = await selectAccounts(db).where(
    and(eq(accounts.userId, userId), sql`lower(${accounts.name}) = lower(${name.trim()})`),
  );
  return row ? toAccount(row) : undefined;
}
