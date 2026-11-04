import { AppError, badRequest, notFound } from "../errors.js";
import type { InvestmentTransactionRepository } from "../repositories/postgres/investment-transaction.repository.js";
import { replayTrades } from "./investment-position.js";

export class DeleteInvestmentTransactionService {
  constructor(private readonly transactions: Pick<InvestmentTransactionRepository, "remove">) {}

  async execute(userId: number, accountId: number, transactionId: number): Promise<void> {
    const removed = await this.transactions.remove(accountId, userId, transactionId, (remaining) => {
      try {
        return replayTrades(remaining);
      } catch (err) {
        // The remaining history is no longer valid (e.g. a later sell exceeds the quantity held).
        if (err instanceof AppError) {
          throw badRequest(`Can't delete this transaction: ${err.message.charAt(0).toLowerCase()}${err.message.slice(1)}`);
        }
        throw err;
      }
    });
    if (!removed) throw notFound("Transaction not found");
  }
}
