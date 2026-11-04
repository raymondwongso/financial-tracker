import { notFound } from "../errors.js";
import type { AccountRepository } from "../repositories/postgres/account.repository.js";

export class DeleteAccountService {
  constructor(private readonly accounts: Pick<AccountRepository, "delete">) {}

  async execute(userId: number, accountId: number): Promise<void> {
    if (!(await this.accounts.delete(accountId, userId))) throw notFound("Account not found");
  }
}
