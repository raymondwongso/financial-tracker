import type { TotalAssets } from "@financialtracker/shared";
import type { AccountRepository } from "../repositories/postgres/account.repository.js";
import type { InvestmentAccountRepository } from "../repositories/postgres/investment-account.repository.js";

export class GetTotalAssetsService {
  constructor(
    private readonly accounts: Pick<AccountRepository, "listByUser">,
    private readonly investments: Pick<InvestmentAccountRepository, "listByUser">,
  ) {}

  async execute(userId: number): Promise<TotalAssets> {
    const [accounts, positions] = await Promise.all([
      this.accounts.listByUser(userId),
      this.investments.listByUser(userId),
    ]);
    const accountsTotal = accounts.reduce((s, a) => s + a.balance, 0);
    const held = positions.filter((p) => p.quantity > 0);
    const investmentsTotal = held.reduce((s, p) => s + (p.marketValue ?? 0), 0);
    const unpricedInvestmentCount = held.filter((p) => p.marketValue === null).length;
    return {
      total: accountsTotal + investmentsTotal,
      accountsTotal,
      investmentsTotal,
      unpricedInvestmentCount,
    };
  }
}
