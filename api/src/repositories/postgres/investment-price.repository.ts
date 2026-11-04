import type { Pool } from "pg";
import type { InvestmentPricePoint } from "@financialtracker/shared";

export class InvestmentPriceRepository {
  constructor(private readonly pool: Pool) {}

  /** Oldest first, so charts can plot it as is. */
  async listByAccount(accountId: number): Promise<InvestmentPricePoint[]> {
    const { rows } = await this.pool.query<{ price_date: string; price: number }>(
      `SELECT to_char(price_date, 'YYYY-MM-DD') AS price_date, price
       FROM investment_price_history WHERE investment_account_id = $1 ORDER BY price_date ASC`,
      [accountId],
    );
    return rows.map((r) => ({ date: r.price_date, price: r.price }));
  }
}
