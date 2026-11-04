import type { Pool } from "pg";
import { round6 } from "../../lib/decimal.js";
import type {
  InvestmentAccount,
  InvestmentAssetType,
  InvestmentListQuery,
  InvestmentSortKey,
  InvestmentUnit,
} from "@financialtracker/shared";

export interface InvestmentAccountRow {
  id: number;
  name: string;
  asset_type: InvestmentAssetType;
  symbol: string;
  unit: InvestmentUnit;
  quantity: number;
  total_cost: number;
  avg_cost: number;
  realized_gain: number;
  last_traded_on: string | null;
  current_price: number | null;
  price_updated_at: Date | null;
  created_at: Date;
}

export const toInvestmentAccount = (r: InvestmentAccountRow): InvestmentAccount => ({
  id: r.id,
  name: r.name,
  assetType: r.asset_type,
  symbol: r.symbol,
  unit: r.unit,
  quantity: r.quantity,
  totalCost: r.total_cost,
  avgCost: r.avg_cost,
  realizedGain: r.realized_gain,
  lastTradedOn: r.last_traded_on,
  currentPrice: r.current_price,
  priceUpdatedAt: r.price_updated_at?.toISOString() ?? null,
  marketValue: r.current_price === null ? null : round6(r.quantity * r.current_price),
  unrealizedGain: r.current_price === null ? null : round6(r.quantity * r.current_price - r.total_cost),
  createdAt: r.created_at.toISOString(),
});

export const INVESTMENT_ACCOUNT_COLUMNS = `
  id, name, asset_type, symbol, unit, quantity, total_cost, avg_cost, realized_gain,
  to_char(last_traded_on, 'YYYY-MM-DD') AS last_traded_on,
  current_price, price_updated_at, created_at`;

// Fixed SQL per sort key: request input only selects from this map, it is never put into the query.
// value/gain are NULL for an unpriced account (same rule as marketValue/unrealizedGain above).
const SORT_EXPRESSIONS: Record<InvestmentSortKey, string> = {
  name: "LOWER(name)",
  value: "quantity * current_price",
  gain: "quantity * current_price - total_cost",
};

export function investmentOrderBy({ sortBy, order }: InvestmentListQuery = {}): string {
  if (!sortBy) return "created_at DESC, id DESC";
  const direction = order === "desc" ? "DESC" : "ASC";
  return `${SORT_EXPRESSIONS[sortBy]} ${direction} NULLS LAST, LOWER(name) ASC, id ASC`;
}

export interface NewInvestmentAccount {
  userId: number;
  name: string;
  assetType: InvestmentAssetType;
  symbol: string;
  unit: InvestmentUnit;
}

export class InvestmentAccountRepository {
  constructor(private readonly pool: Pool) {}

  async create(a: NewInvestmentAccount): Promise<InvestmentAccount> {
    const { rows } = await this.pool.query<InvestmentAccountRow>(
      `INSERT INTO investment_accounts (user_id, name, asset_type, symbol, unit)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${INVESTMENT_ACCOUNT_COLUMNS}`,
      [a.userId, a.name, a.assetType, a.symbol, a.unit],
    );
    return toInvestmentAccount(rows[0]!);
  }

  async listByUser(userId: number, sort: InvestmentListQuery = {}): Promise<InvestmentAccount[]> {
    const { rows } = await this.pool.query<InvestmentAccountRow>(
      `SELECT ${INVESTMENT_ACCOUNT_COLUMNS} FROM investment_accounts
       WHERE user_id = $1 ORDER BY ${investmentOrderBy(sort)}`,
      [userId],
    );
    return rows.map(toInvestmentAccount);
  }

  async findByIdForUser(id: number, userId: number): Promise<InvestmentAccount | null> {
    const { rows } = await this.pool.query<InvestmentAccountRow>(
      `SELECT ${INVESTMENT_ACCOUNT_COLUMNS} FROM investment_accounts WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );
    return rows[0] ? toInvestmentAccount(rows[0]) : null;
  }

  /**
   * Records the price for `date` (overwriting that day's entry) in the price history. The account's
   * current price only follows the history when `date` is the latest one, so back-dating a price
   * never replaces a newer one. Returns null when the account is not this user's.
   */
  async setPrice(id: number, userId: number, price: number, date: string): Promise<InvestmentAccount | null> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const locked = await client.query(
        "SELECT id FROM investment_accounts WHERE id = $1 AND user_id = $2 FOR UPDATE",
        [id, userId],
      );
      if (locked.rows.length === 0) {
        await client.query("ROLLBACK");
        return null;
      }
      await client.query(
        `INSERT INTO investment_price_history (investment_account_id, price_date, price)
         VALUES ($1, $2, $3)
         ON CONFLICT (investment_account_id, price_date) DO UPDATE SET price = EXCLUDED.price`,
        [id, date, price],
      );
      const { rows } = await client.query<InvestmentAccountRow>(
        `UPDATE investment_accounts
         SET current_price = CASE WHEN $2::date = latest.d THEN $3 ELSE current_price END,
             price_updated_at = CASE WHEN $2::date = latest.d THEN now() ELSE price_updated_at END
         FROM (SELECT max(price_date) AS d FROM investment_price_history WHERE investment_account_id = $1) latest
         WHERE investment_accounts.id = $1
         RETURNING ${INVESTMENT_ACCOUNT_COLUMNS}`,
        [id, date, price],
      );
      await client.query("COMMIT");
      return toInvestmentAccount(rows[0]!);
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  /** Deletes the account with its trades and price history atomically. False when not this user's. */
  async delete(id: number, userId: number): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const locked = await client.query(
        "SELECT id FROM investment_accounts WHERE id = $1 AND user_id = $2 FOR UPDATE",
        [id, userId],
      );
      if (locked.rows.length === 0) {
        await client.query("ROLLBACK");
        return false;
      }
      await client.query("DELETE FROM investment_transactions WHERE investment_account_id = $1", [id]);
      await client.query("DELETE FROM investment_price_history WHERE investment_account_id = $1", [id]);
      await client.query("DELETE FROM investment_accounts WHERE id = $1", [id]);
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
