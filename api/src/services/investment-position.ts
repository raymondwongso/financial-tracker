import type { InvestmentSide } from "@financialtracker/shared";
import { badRequest } from "../errors.js";
import { round6 } from "../lib/decimal.js";

/** Running state of an investment account (moving-average cost method). */
export interface Position {
  quantity: number;
  totalCost: number;
  realizedGain: number;
}

export interface Trade {
  side: InvestmentSide;
  quantity: number;
  unitPrice: number;
}

/** Column limits: quantity NUMERIC(20,6); costs stay below 2^53 so JS numbers are exact. */
export const MAX_QUANTITY = 99_999_999_999_999;
export const MAX_AMOUNT = 999_999_999_999_999;

const tooLarge = () => badRequest("This transaction exceeds the maximum supported amount");

/**
 * Applies one trade to the running position in O(1), no history replay.
 * Buy: cost grows by q*p. Sell: the sold units leave at the current average cost
 * (average is unchanged), the difference to the sale proceeds is realized.
 * Callers must apply trades in chronological order.
 */
export function applyTrade(pos: Position, t: Trade): Position {
  if (t.side === "buy") {
    const quantity = round6(pos.quantity + t.quantity);
    const totalCost = round6(pos.totalCost + t.quantity * t.unitPrice);
    if (quantity > MAX_QUANTITY || totalCost > MAX_AMOUNT) throw tooLarge();
    return { quantity, totalCost, realizedGain: pos.realizedGain };
  }
  if (t.quantity > pos.quantity) {
    throw badRequest("Cannot sell more than the quantity held");
  }
  const remaining = round6(pos.quantity - t.quantity);
  // Selling everything (down to the column precision) clears the cost exactly, so no
  // residual cost is left on an empty position; otherwise remove the proportional share.
  const costRemoved = remaining === 0 ? pos.totalCost : (pos.totalCost * t.quantity) / pos.quantity;
  const realizedGain = round6(pos.realizedGain + t.quantity * t.unitPrice - costRemoved);
  if (Math.abs(realizedGain) > MAX_AMOUNT) throw tooLarge();
  return { quantity: remaining, totalCost: remaining === 0 ? 0 : round6(pos.totalCost - costRemoved), realizedGain };
}

export const averageCost = (pos: Position): number =>
  pos.quantity === 0 ? 0 : round6(pos.totalCost / pos.quantity);

/** Rebuilds a position from scratch by applying trades in the given (chronological) order. */
export function replayTrades(trades: Trade[]): Position {
  return trades.reduce<Position>(applyTrade, { quantity: 0, totalCost: 0, realizedGain: 0 });
}
