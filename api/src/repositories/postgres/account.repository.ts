import type { Pool } from "pg";
import type { Account, AccountWithBalance, AccountTotals } from "@financialtracker/shared";

interface AccountRow {
  id: number;
  name: string;
  description: string;
  initial_balance: number;
  created_at: Date;
  balance: number;
  last_transaction_at: Date | null;
}

const toAccount = (r: AccountRow): AccountWithBalance => ({
  id: r.id,
  name: r.name,
  description: r.description,
  initialBalance: r.initial_balance,
  createdAt: r.created_at.toISOString(),
  balance: r.balance,
  lastTransactionAt: r.last_transaction_at?.toISOString() ?? null,
});

const SELECT = `
  SELECT a.id, a.name, a.description, a.initial_balance, a.created_at,
         a.initial_balance + COALESCE(SUM(CASE t.type WHEN 'income' THEN t.amount ELSE -t.amount END), 0) AS balance,
         MAX(t.created_at) AS last_transaction_at
  FROM accounts a
  LEFT JOIN transactions t ON t.account_id = a.id`;

export interface NewAccount {
  userId: number;
  name: string;
  description: string;
  initialBalance: number;
}

export class AccountRepository {
  constructor(private readonly pool: Pool) {}

  async create(a: NewAccount): Promise<Account> {
    const { rows } = await this.pool.query<{
      id: number; name: string; description: string; initial_balance: number; created_at: Date;
    }>(
      `INSERT INTO accounts (user_id, name, description, initial_balance)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, description, initial_balance, created_at`,
      [a.userId, a.name, a.description, a.initialBalance],
    );
    const r = rows[0]!;
    return {
      id: r.id,
      name: r.name,
      description: r.description,
      initialBalance: r.initial_balance,
      createdAt: r.created_at.toISOString(),
    };
  }

  async listByUser(userId: number): Promise<AccountWithBalance[]> {
    const { rows } = await this.pool.query<AccountRow>(
      `${SELECT} WHERE a.user_id = $1 GROUP BY a.id ORDER BY a.created_at DESC, a.id DESC`,
      [userId],
    );
    return rows.map(toAccount);
  }

  async findByIdForUser(id: number, userId: number): Promise<AccountWithBalance | null> {
    const { rows } = await this.pool.query<AccountRow>(
      `${SELECT} WHERE a.id = $1 AND a.user_id = $2 GROUP BY a.id`,
      [id, userId],
    );
    return rows[0] ? toAccount(rows[0]) : null;
  }

  /** Per-account income/expense in [from, to] (inclusive dates); every account is listed. */
  async totalsByUser(userId: number, from: string | null, to: string | null): Promise<AccountTotals[]> {
    const { rows } = await this.pool.query<{
      id: number; name: string; income: number; expense: number;
    }>(
      `SELECT a.id, a.name,
              COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'income'), 0) AS income,
              COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'expense'), 0) AS expense
       FROM accounts a
       LEFT JOIN transactions t ON t.account_id = a.id
         AND ($2::date IS NULL OR t.created_at >= $2::date)
         AND ($3::date IS NULL OR t.created_at < $3::date + 1)
       WHERE a.user_id = $1
       GROUP BY a.id ORDER BY a.created_at, a.id`,
      [userId, from, to],
    );
    return rows.map((r) => ({
      accountId: r.id,
      accountName: r.name,
      income: r.income,
      expense: r.expense,
    }));
  }

  /** Deletes the account and all its transactions atomically. False when it is not this user's. */
  async delete(id: number, userId: number): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const locked = await client.query(
        "SELECT id FROM accounts WHERE id = $1 AND user_id = $2 FOR UPDATE",
        [id, userId],
      );
      if (locked.rows.length === 0) {
        await client.query("ROLLBACK");
        return false;
      }
      await client.query("DELETE FROM transactions WHERE account_id = $1", [id]);
      await client.query("DELETE FROM accounts WHERE id = $1", [id]);
      await client.query("COMMIT");
      return true;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
}
