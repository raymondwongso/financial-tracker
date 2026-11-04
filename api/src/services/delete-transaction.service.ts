import { notFound } from "../errors.js";
import type { TransactionRepository } from "../repositories/postgres/transaction.repository.js";

export class DeleteTransactionService {
  constructor(private readonly transactions: Pick<TransactionRepository, "delete">) {}

  async execute(userId: number, transactionId: number): Promise<void> {
    if (!(await this.transactions.delete(transactionId, userId))) {
      throw notFound("Transaction not found");
    }
  }
}
