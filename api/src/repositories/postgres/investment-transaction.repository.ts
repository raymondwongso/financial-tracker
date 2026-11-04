import type { Pool } from "pg";
import type { InvestmentSide, InvestmentTransaction } from "@financialtracker/shared";
import type { Position, Trade } from "../../services/investment-position.js";

interface TxRow {
  id: number;
  investment_account_id: number;
  side: InvestmentSide;
  traded_on: string;
  quantity: number;
  unit_price: number;
  note: string | null;
  created_at: Date;
}

const COLUMNS = `id, investment_account_id, side, to_char(traded_on, 'YYYY-MM-DD') AS traded_on,
  quantity, unit_price, note, created_at`;

const toTx = (r: TxRow): InvestmentTransaction => ({
  id: r.id,
  investmentAccountId: r.investment_account_id,
  side: r.side,
  tradedOn: r.traded_on,
  quantity: r.quantity,
  unitPrice: r.unit_price,
  note: r.note,
  createdAt: r.created_at.toISOString(),
});

export interface NewInvestmentTransaction {
  side: InvestmentSide;
  tradedOn: string;
  quantity: number;
  unitPrice: number;
  note: string | null;
}

/** State read under the row lock; `decide` returns the next position or throws to roll back. */
export interface LockedAccountState extends Position {
  lastTradedOn: string | null;
}

export class InvestmentTransactionRepository {
  constructor(private readonly pool: Pool) {}

  /**
   * Atomically: lock the account row, let `decide` validate and compute the new position
   * from the stored running state, insert the transaction and persist the position.
   * Returns null when the account does not exist for this user.
   */
  async record(
    accountId: number,
    userId: number,
    tx: NewInvestmentTransaction,
    decide: (state: LockedAccountState) => Position,
  ): Promise<InvestmentTransaction | null> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const locked = await client.query<{
        quantity: number; total_cost: number; realized_gain: number; last_traded_on: string | null;
      }>(
        `SELECT quantity, total_cost, realized_gain, to_char(last_traded_on, 'YYYY-MM-DD') AS last_traded_on
         FROM investment_accounts WHERE id = $1 AND user_id = $2 FOR UPDATE`,
        [accountId, userId],
      );
      const s = locked.rows[0];
      if (!s) {
        await client.query("ROLLBACK");
        return null;
      }
      const next = decide({
        quantity: s.quantity,
        totalCost: s.total_cost,
        realizedGain: s.realized_gain,
        lastTradedOn: s.last_traded_on,
      });
      const inserted = await client.query<TxRow>(
        `INSERT INTO investment_transactions
           (investment_account_id, side, traded_on, quantity, unit_price, note)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING ${COLUMNS}`,
        [accountId, tx.side, tx.tradedOn, tx.quantity, tx.unitPrice, tx.note],
      );
      await client.query(
        `UPDATE investment_accounts
         SET quantity = $2, total_cost = $3, realized_gain = $4, last_traded_on = $5
         WHERE id = $1`,
        [accountId, next.quantity, next.totalCost, next.realizedGain, tx.tradedOn],
      );
      await client.query("COMMIT");
      return toTx(inserted.rows[0]!);
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Atomically: lock the account, load the remaining trades (chronological, without `txId`),
   * let `decide` replay them (it throws to veto the delete), then delete the transaction and
   * persist the rebuilt position. Returns false when the transaction is not in this user's account.
   */
  async remove(
    accountId: number,
    userId: number,
    txId: number,
    decide: (remaining: Trade[]) => Position,
  ): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const locked = await client.query(
        "SELECT id FROM investment_accounts WHERE id = $1 AND user_id = $2 FOR UPDATE",
        [accountId, userId],
      );
      if (locked.rows.length === 0) {
        await client.query("ROLLBACK");
        return false;
      }
      const target = await client.query(
        "SELECT id FROM investment_transactions WHERE id = $1 AND investment_account_id = $2",
        [txId, accountId],
      );
      if (target.rows.length === 0) {
        await client.query("ROLLBACK");
        return false;
      }
      const { rows } = await client.query<{
        side: InvestmentSide; quantity: number; unit_price: number; traded_on: string;
      }>(
        `SELECT side, quantity, unit_price, to_char(traded_on, 'YYYY-MM-DD') AS traded_on
         FROM investment_transactions
         WHERE investment_account_id = $1 AND id <> $2
         ORDER BY traded_on ASC, id ASC`,
        [accountId, txId],
      );
      const next = decide(rows.map((r) => ({ side: r.side, quantity: r.quantity, unitPrice: r.unit_price })));
      await client.query("DELETE FROM investment_transactions WHERE id = $1", [txId]);
      await client.query(
        `UPDATE investment_accounts
         SET quantity = $2, total_cost = $3, realized_gain = $4, last_traded_on = $5
         WHERE id = $1`,
        [accountId, next.quantity, next.totalCost, next.realizedGain, rows.at(-1)?.traded_on ?? null],
      );
      await client.query("COMMIT");
      return true;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  async listByAccount(accountId: number): Promise<InvestmentTransaction[]> {
    const { rows } = await this.pool.query<TxRow>(
      `SELECT ${COLUMNS} FROM investment_transactions
       WHERE investment_account_id = $1 ORDER BY traded_on DESC, id DESC`,
      [accountId],
    );
    return rows.map(toTx);
  }
}
