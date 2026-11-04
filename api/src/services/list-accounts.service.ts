import type { AccountWithBalance } from "@financialtracker/shared";
import type { AccountRepository } from "../repositories/postgres/account.repository.js";

export class ListAccountsService {
  constructor(private readonly accounts: Pick<AccountRepository, "listByUser">) {}
  execute(userId: number): Promise<AccountWithBalance[]> {
    return this.accounts.listByUser(userId);
  }
}
