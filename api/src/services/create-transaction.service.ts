import type { CreateTransactionRequest, Transaction } from "@financialtracker/shared";
import { badRequest, notFound } from "../errors.js";
import type { AccountRepository } from "../repositories/postgres/account.repository.js";
import type { CategoryRepository } from "../repositories/postgres/category.repository.js";
import type { TransactionRepository } from "../repositories/postgres/transaction.repository.js";

export class CreateTransactionService {
  constructor(
    private readonly accounts: Pick<AccountRepository, "findByIdForUser">,
    private readonly categories: Pick<CategoryRepository, "findByIdForUser">,
    private readonly transactions: Pick<TransactionRepository, "create">,
  ) {}

  async execute(userId: number, req: CreateTransactionRequest): Promise<Transaction> {
    if (!Number.isInteger(req.amount) || req.amount <= 0 || req.amount > 999_999_999_999_999) {
      throw badRequest("Amount must be a positive whole number of at most 15 digits");
    }
    const description = req.description?.trim() || null;
    if (description && description.length > 120) {
      throw badRequest("Description must be at most 120 characters");
    }
    let occurredAt: Date | null = null;
    if (req.occurredAt !== undefined) {
      occurredAt = new Date(req.occurredAt);
      if (Number.isNaN(occurredAt.getTime())) {
        throw badRequest("Date is invalid");
      }
      if (occurredAt.getTime() > Date.now()) {
        throw badRequest("Date cannot be in the future");
      }
    }
    if (!(await this.accounts.findByIdForUser(req.accountId, userId))) {
      throw notFound("Account not found");
    }
    if (!(await this.categories.findByIdForUser(req.categoryId, userId))) {
      throw notFound("Category not found");
    }
    return this.transactions.create({
      accountId: req.accountId,
      categoryId: req.categoryId,
      type: req.type,
      amount: req.amount,
      description,
      createdAt: occurredAt,
    });
  }
}
