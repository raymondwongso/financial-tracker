import { and, asc, eq, gte, lt, sql } from 'drizzle-orm';
import type { MonthlySummary } from '../../schemas/summary';
import { monthRange } from '../../money';
import type { Db } from '../client';
import { accounts, transactions } from '../schema';

const income =
  sql<number>`coalesce(sum(${transactions.amountMinor}) filter (where ${transactions.type} = 'income'), 0)`.mapWith(
    Number,
  );
const expense =
  sql<number>`coalesce(sum(${transactions.amountMinor}) filter (where ${transactions.type} = 'expense'), 0)`.mapWith(
    Number,
  );

export async function monthlySummary(
  db: Db,
  userId: string,
  month: string,
): Promise<MonthlySummary> {
  const { start, end } = monthRange(month);
  const inMonth = and(
    eq(transactions.userId, userId),
    gte(transactions.occurredOn, start),
    lt(transactions.occurredOn, end),
  );

  const byAccountRows = await db
    .select({
      accountId: accounts.id,
      accountName: accounts.name,
      currency: accounts.currency,
      incomeMinor: income,
      expenseMinor: expense,
    })
    .from(transactions)
    .innerJoin(accounts, eq(accounts.id, transactions.accountId))
    .where(inMonth)
    .groupBy(accounts.id)
    .orderBy(asc(accounts.name));

  const byCategory = await db
    .select({
      currency: accounts.currency,
      type: transactions.type,
      category: transactions.category,
      totalMinor: sql<number>`sum(${transactions.amountMinor})`.mapWith(Number),
    })
    .from(transactions)
    .innerJoin(accounts, eq(accounts.id, transactions.accountId))
    .where(inMonth)
    .groupBy(accounts.currency, transactions.type, transactions.category)
    .orderBy(asc(accounts.currency), asc(transactions.type), sql`4 desc`);

  const byAccount = byAccountRows.map((r) => ({ ...r, netMinor: r.incomeMinor - r.expenseMinor }));

  const totalsByCurrency = new Map<string, { incomeMinor: number; expenseMinor: number }>();
  for (const row of byAccount) {
    const t = totalsByCurrency.get(row.currency) ?? { incomeMinor: 0, expenseMinor: 0 };
    t.incomeMinor += row.incomeMinor;
    t.expenseMinor += row.expenseMinor;
    totalsByCurrency.set(row.currency, t);
  }
  const totals = [...totalsByCurrency.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, t]) => ({ currency, ...t, netMinor: t.incomeMinor - t.expenseMinor }));

  return { month, totals, byAccount, byCategory };
}
