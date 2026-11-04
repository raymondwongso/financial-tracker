import type { InvestmentAccountList, InvestmentListQuery } from "@financialtracker/shared";
import type { InvestmentAccountRepository } from "../repositories/postgres/investment-account.repository.js";

export class ListInvestmentAccountsService {
  constructor(private readonly accounts: Pick<InvestmentAccountRepository, "listByUser">) {}

  async execute(userId: number, query: InvestmentListQuery = {}): Promise<InvestmentAccountList> {
    const items = await this.accounts.listByUser(userId, query);
    const totalCost = items.reduce((s, a) => s + a.totalCost, 0);
    // Value/gain are only meaningful when every held position has a price.
    const unpriced = items.some((a) => a.quantity > 0 && a.marketValue === null);
    const totalValue = unpriced ? null : items.reduce((s, a) => s + (a.marketValue ?? 0), 0);
    return {
      items,
      summary: {
        totalCost,
        totalValue,
        unrealizedGain: totalValue === null ? null : totalValue - totalCost,
      },
    };
  }
}
