import type { InvestmentTransaction } from "@financialtracker/shared";
import { notFound } from "../errors.js";
import type { InvestmentAccountRepository } from "../repositories/postgres/investment-account.repository.js";
import type { InvestmentTransactionRepository } from "../repositories/postgres/investment-transaction.repository.js";

export class ListInvestmentTransactionsService {
  constructor(
    private readonly accounts: Pick<InvestmentAccountRepository, "findByIdForUser">,
    private readonly transactions: Pick<InvestmentTransactionRepository, "listByAccount">,
  ) {}
  async execute(userId: number, accountId: number): Promise<InvestmentTransaction[]> {
    if (!(await this.accounts.findByIdForUser(accountId, userId))) {
      throw notFound("Investment account not found");
    }
    return this.transactions.listByAccount(accountId);
  }
}
