import type { Pool } from "pg";
import type { CategoryTotal, Transaction, TransactionType } from "@financialtracker/shared";
import type { TransactionCursor } from "../../lib/cursor.js";

interface TxRow {
  id: number;
  account_id: number;
  category_id: number;
  category_name: string;
  type: TransactionType;
  amount: number;
  description: string | null;
  created_at: Date;
}

const toTx = (r: TxRow): Transaction => ({
  id: r.id,
  accountId: r.account_id,
  categoryId: r.category_id,
  categoryName: r.category_name,
  type: r.type,
  amount: r.amount,
  description: r.description,
  createdAt: r.created_at.toISOString(),
});

export interface NewTransaction {
  accountId: number;
  categoryId: number;
  type: TransactionType;
  amount: number;
  description: string | null;
  /** Null means use the column default (now()). */
  createdAt: Date | null;
}

export interface TransactionQuery {
  accountId: number;
  from: string | null;
  to: string | null;
  limit: number;
  cursor: TransactionCursor | null;
}

const RANGE = `
  AND ($2::date IS NULL OR t.created_at >= $2::date)
  AND ($3::date IS NULL OR t.created_at < $3::date + 1)`;

export class TransactionRepository {
  constructor(private readonly pool: Pool) {}

  async create(t: NewTransaction): Promise<Transaction> {
    const { rows } = await this.pool.query<TxRow>(
      `WITH ins AS (
         INSERT INTO transactions (account_id, category_id, type, amount, description, created_at)
         VALUES ($1, $2, $3, $4, $5, COALESCE($6::timestamptz, now())) RETURNING *
       )
       SELECT ins.*, c.name AS category_name FROM ins JOIN categories c ON c.id = ins.category_id`,
      [t.accountId, t.categoryId, t.type, t.amount, t.description, t.createdAt],
    );
    return toTx(rows[0]!);
  }

  /** Deletes a transaction owned (via its account) by the user. Returns false when none matched. */
  async delete(id: number, userId: number): Promise<boolean> {
    const { rowCount } = await this.pool.query(
      `DELETE FROM transactions t USING accounts a
       WHERE t.id = $1 AND a.id = t.account_id AND a.user_id = $2`,
      [id, userId],
    );
    return (rowCount ?? 0) > 0;
  }

  /** Newest first (ordered at millisecond precision, matching the cursor's JS timestamps). Fetches limit + 1 rows so the caller can tell whether another page exists. */
  async list(q: TransactionQuery): Promise<Transaction[]> {
    const { rows } = await this.pool.query<TxRow>(
      `SELECT t.id, t.account_id, t.category_id, c.name AS category_name, t.type, t.amount,
              t.description, t.created_at
       FROM transactions t JOIN categories c ON c.id = t.category_id
       WHERE t.account_id = $1 ${RANGE}
         AND ($4::timestamptz IS NULL OR (date_trunc('milliseconds', t.created_at), t.id) < ($4::timestamptz, $5::bigint))
       ORDER BY date_trunc('milliseconds', t.created_at) DESC, t.id DESC
       LIMIT $6`,
      [q.accountId, q.from, q.to, q.cursor?.createdAt ?? null, q.cursor?.id ?? null, q.limit + 1],
    );
    return rows.map(toTx);
  }

  async count(accountId: number, from: string | null, to: string | null): Promise<number> {
    const { rows } = await this.pool.query<{ n: number }>(
      `SELECT COUNT(*) AS n FROM transactions t WHERE t.account_id = $1 ${RANGE}`,
      [accountId, from, to],
    );
    return rows[0]!.n;
  }

  async totalsByCategory(
    accountId: number,
    from: string | null,
    to: string | null,
  ): Promise<{ type: TransactionType; total: CategoryTotal }[]> {
    const { rows } = await this.pool.query<{
      type: TransactionType; category_id: number; category_name: string; amount: number;
    }>(
      `SELECT t.type, c.id AS category_id, c.name AS category_name, SUM(t.amount) AS amount
       FROM transactions t JOIN categories c ON c.id = t.category_id
       WHERE t.account_id = $1 ${RANGE}
       GROUP BY t.type, c.id, c.name ORDER BY amount DESC`,
      [accountId, from, to],
    );
    return rows.map((r) => ({
      type: r.type,
      total: { categoryId: r.category_id, categoryName: r.category_name, amount: r.amount },
    }));
  }
}
