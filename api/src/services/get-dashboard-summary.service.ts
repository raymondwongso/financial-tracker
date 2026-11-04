import type { DashboardSummary } from "@financialtracker/shared";
import type { AccountRepository } from "../repositories/postgres/account.repository.js";

export class GetDashboardSummaryService {
  constructor(private readonly accounts: Pick<AccountRepository, "totalsByUser">) {}
  async execute(userId: number, from: string | null, to: string | null): Promise<DashboardSummary> {
    return { accounts: await this.accounts.totalsByUser(userId, from, to) };
  }
}
