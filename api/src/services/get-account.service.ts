import type { AccountWithBalance } from "@financialtracker/shared";
import { notFound } from "../errors.js";
import type { AccountRepository } from "../repositories/postgres/account.repository.js";

export class GetAccountService {
  constructor(private readonly accounts: Pick<AccountRepository, "findByIdForUser">) {}
  async execute(userId: number, id: number): Promise<AccountWithBalance> {
    const account = await this.accounts.findByIdForUser(id, userId);
    if (!account) throw notFound("Account not found");
    return account;
  }
}
