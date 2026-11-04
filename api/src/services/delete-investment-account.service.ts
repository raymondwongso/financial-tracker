import { notFound } from "../errors.js";
import type { InvestmentAccountRepository } from "../repositories/postgres/investment-account.repository.js";

export class DeleteInvestmentAccountService {
  constructor(private readonly accounts: Pick<InvestmentAccountRepository, "delete">) {}

  async execute(userId: number, accountId: number): Promise<void> {
    if (!(await this.accounts.delete(accountId, userId))) throw notFound("Investment account not found");
  }
}
