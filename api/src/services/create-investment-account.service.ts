import type { CreateInvestmentAccountRequest, InvestmentAccount } from "@financialtracker/shared";
import { badRequest, conflict } from "../errors.js";
import type { InvestmentAccountRepository } from "../repositories/postgres/investment-account.repository.js";

export class CreateInvestmentAccountService {
  constructor(private readonly accounts: Pick<InvestmentAccountRepository, "create">) {}

  async execute(userId: number, req: CreateInvestmentAccountRequest): Promise<InvestmentAccount> {
    const name = req.name.trim();
    if (!name) throw badRequest("Name is required");
    const isGold = req.assetType === "gold";
    const symbol = isGold ? "GOLD" : (req.symbol ?? "").trim().toUpperCase();
    if (!symbol) throw badRequest("Ticker is required for stocks");
    return this.accounts
      .create({ userId, name, assetType: req.assetType, symbol, unit: isGold ? "gram" : "share" })
      .catch((err: unknown) => {
        if (typeof err === "object" && err !== null && (err as { code?: string }).code === "23505") {
          throw conflict("An investment account with this name already exists");
        }
        throw err;
      });
  }
}
