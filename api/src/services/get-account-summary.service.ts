import type { AccountSummary } from "@financialtracker/shared";
import { notFound } from "../errors.js";
import type { AccountRepository } from "../repositories/postgres/account.repository.js";
import type { TransactionRepository } from "../repositories/postgres/transaction.repository.js";

export class GetAccountSummaryService {
  constructor(
    private readonly accounts: Pick<AccountRepository, "findByIdForUser">,
    private readonly transactions: Pick<TransactionRepository, "totalsByCategory">,
  ) {}

  async execute(userId: number, accountId: number, from: string | null, to: string | null): Promise<AccountSummary> {
    if (!(await this.accounts.findByIdForUser(accountId, userId))) throw notFound("Account not found");
    const rows = await this.transactions.totalsByCategory(accountId, from, to);
    return {
      income: rows.filter((r) => r.type === "income").map((r) => r.total),
      expense: rows.filter((r) => r.type === "expense").map((r) => r.total),
    };
  }
}
