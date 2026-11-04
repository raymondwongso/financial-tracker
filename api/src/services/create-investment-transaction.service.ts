import type { CreateInvestmentTransactionRequest, InvestmentTransaction } from "@financialtracker/shared";
import { badRequest, notFound } from "../errors.js";
import { hasAtMostDecimals } from "../lib/decimal.js";
import type { InvestmentTransactionRepository } from "../repositories/postgres/investment-transaction.repository.js";
import { applyTrade } from "./investment-position.js";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export class CreateInvestmentTransactionService {
  constructor(
    private readonly transactions: Pick<InvestmentTransactionRepository, "record">,
    private readonly today: () => string = () => new Date().toISOString().slice(0, 10),
  ) {}

  async execute(
    userId: number,
    accountId: number,
    req: CreateInvestmentTransactionRequest,
  ): Promise<InvestmentTransaction> {
    if (!ISO_DATE.test(req.tradedOn) || Number.isNaN(Date.parse(req.tradedOn))) {
      throw badRequest("Date must be YYYY-MM-DD");
    }
    if (req.tradedOn > this.today()) throw badRequest("Date cannot be in the future");
    if (!(req.quantity > 0)) throw badRequest("Quantity must be greater than zero");
    if (!(req.unitPrice > 0)) throw badRequest("Price must be greater than zero");
    // Matches the column precision (NUMERIC(20,6) / NUMERIC(15,2)); more would be silently rounded by the DB.
    if (!hasAtMostDecimals(req.quantity, 6)) throw badRequest("Quantity can have at most 6 decimals");
    if (!hasAtMostDecimals(req.unitPrice, 2)) throw badRequest("Price can have at most 2 decimals");

    const created = await this.transactions.record(
      accountId,
      userId,
      {
        side: req.side,
        tradedOn: req.tradedOn,
        quantity: req.quantity,
        unitPrice: req.unitPrice,
        note: req.note?.trim() || null,
      },
      (state) => {
        // The stored running average is only valid if trades are applied in date order.
        if (state.lastTradedOn !== null && req.tradedOn < state.lastTradedOn) {
          throw badRequest(`Date cannot be before the last transaction (${state.lastTradedOn})`);
        }
        return applyTrade(state, req);
      },
    );
    if (!created) throw notFound("Investment account not found");
    return created;
  }
}
