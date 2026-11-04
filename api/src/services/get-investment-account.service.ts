import type { InvestmentAccount } from "@financialtracker/shared";
import { notFound } from "../errors.js";
import type { InvestmentAccountRepository } from "../repositories/postgres/investment-account.repository.js";

export class GetInvestmentAccountService {
  constructor(private readonly accounts: Pick<InvestmentAccountRepository, "findByIdForUser">) {}
  async execute(userId: number, id: number): Promise<InvestmentAccount> {
    const account = await this.accounts.findByIdForUser(id, userId);
    if (!account) throw notFound("Investment account not found");
    return account;
  }
}
