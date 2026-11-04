import type { InvestmentPricePoint } from "@financialtracker/shared";
import { notFound } from "../errors.js";
import type { InvestmentAccountRepository } from "../repositories/postgres/investment-account.repository.js";
import type { InvestmentPriceRepository } from "../repositories/postgres/investment-price.repository.js";

export class ListInvestmentPriceHistoryService {
  constructor(
    private readonly accounts: Pick<InvestmentAccountRepository, "findByIdForUser">,
    private readonly prices: Pick<InvestmentPriceRepository, "listByAccount">,
  ) {}
  async execute(userId: number, accountId: number): Promise<InvestmentPricePoint[]> {
    if (!(await this.accounts.findByIdForUser(accountId, userId))) {
      throw notFound("Investment account not found");
    }
    return this.prices.listByAccount(accountId);
  }
}
