import type { InvestmentAccount } from "@financialtracker/shared";
import { badRequest, notFound } from "../errors.js";
import { hasAtMostDecimals } from "../lib/decimal.js";
import type { InvestmentAccountRepository } from "../repositories/postgres/investment-account.repository.js";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export class SetInvestmentPriceService {
  constructor(
    private readonly accounts: Pick<InvestmentAccountRepository, "setPrice">,
    private readonly today: () => string = () => new Date().toISOString().slice(0, 10),
  ) {}

  async execute(userId: number, id: number, price: number, date?: string): Promise<InvestmentAccount> {
    if (!Number.isFinite(price) || price <= 0) throw badRequest("Price must be greater than zero");
    // Matches NUMERIC(15,2); more decimals would be silently rounded by the DB.
    if (!hasAtMostDecimals(price, 2)) throw badRequest("Price can have at most 2 decimals");
    const day = date ?? this.today();
    if (!ISO_DATE.test(day) || Number.isNaN(Date.parse(day))) throw badRequest("Date must be YYYY-MM-DD");
    if (day > this.today()) throw badRequest("Date cannot be in the future");
    const account = await this.accounts.setPrice(id, userId, price, day);
    if (!account) throw notFound("Investment account not found");
    return account;
  }
}
