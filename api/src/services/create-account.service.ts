import type { Account, CreateAccountRequest } from "@financialtracker/shared";
import { badRequest, conflict } from "../errors.js";
import type { AccountRepository } from "../repositories/postgres/account.repository.js";

export class CreateAccountService {
  constructor(private readonly accounts: Pick<AccountRepository, "create">) {}

  async execute(userId: number, req: CreateAccountRequest): Promise<Account> {
    const name = req.name.trim();
    if (!name) throw badRequest("Name is required");
    if (!Number.isInteger(req.initialBalance) || req.initialBalance < 0) {
      throw badRequest("Initial balance must be a non-negative whole number");
    }
    return this.accounts
      .create({
        userId,
        name,
        description: (req.description ?? "").trim(),
        initialBalance: req.initialBalance,
      })
      .catch((err: unknown) => {
        if (typeof err === "object" && err !== null && (err as { code?: string }).code === "23505") {
          throw conflict("An account with this name already exists");
        }
        throw err;
      });
  }
}
