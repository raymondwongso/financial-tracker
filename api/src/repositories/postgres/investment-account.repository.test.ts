import assert from "node:assert/strict";
import { test } from "node:test";
import { applyTrade, averageCost, type Position, type Trade } from "../../services/investment-position.js";
import { toInvestmentAccount, type InvestmentAccountRow } from "./investment-account.repository.js";

const row = (o: Partial<InvestmentAccountRow> = {}): InvestmentAccountRow => ({
  id: 1,
  name: "BBCA",
  asset_type: "stock",
  symbol: "BBCA",
  unit: "share",
  quantity: 200,
  total_cost: 1_100_000,
  avg_cost: 5500,
  realized_gain: 0,
  last_traded_on: "2026-05-10",
  current_price: null,
  price_updated_at: null,
  created_at: new Date("2026-01-01T00:00:00.000Z"),
  ...o,
});

/** A row as the DB would store it after the given trades (avg_cost is the generated column). */
function rowAfter(trades: Trade[], price: number | null): InvestmentAccountRow {
  const p: Position = trades.reduce(applyTrade, { quantity: 0, totalCost: 0, realizedGain: 0 });
  return row({
    quantity: p.quantity,
    total_cost: p.totalCost,
    avg_cost: averageCost(p),
    realized_gain: p.realizedGain,
    current_price: price,
  });
}
const buy = (quantity: number, unitPrice: number): Trade => ({ side: "buy", quantity, unitPrice });
const sell = (quantity: number, unitPrice: number): Trade => ({ side: "sell", quantity, unitPrice });

test("D33 value = quantity * price and unrealized = value - cost, for gain, loss and break-even", () => {
  const up = toInvestmentAccount(row({ current_price: 6500 }));
  assert.equal(up.marketValue, 1_300_000);
  assert.equal(up.unrealizedGain, 200_000);
  const down = toInvestmentAccount(row({ current_price: 5000 }));
  assert.equal(down.marketValue, 1_000_000);
  assert.equal(down.unrealizedGain, -100_000);
  const even = toInvestmentAccount(row({ current_price: 5500 }));
  assert.equal(even.unrealizedGain, 0);
});

test("D34 no price yet gives null value and gain, not zero", () => {
  const a = toInvestmentAccount(row({ current_price: null }));
  assert.equal(a.marketValue, null);
  assert.equal(a.unrealizedGain, null);
  assert.equal(a.currentPrice, null);
});

test("D35 after a full sell a priced account is worth exactly zero with no residual gain", () => {
  const a = toInvestmentAccount(rowAfter([buy(3, 100), sell(3, 120)], 6500));
  assert.equal(a.quantity, 0);
  assert.equal(a.marketValue, 0);
  assert.ok(Object.is(a.unrealizedGain, 0), "unrealized is +0, not -0 or a leftover");
  assert.equal(a.realizedGain, 60);
});

test("D36 after a partial sell unrealized gain uses only the remaining cost", () => {
  const a = toInvestmentAccount(rowAfter([buy(100, 5000), buy(100, 6000), sell(50, 7000)], 6000));
  assert.equal(a.quantity, 150);
  assert.equal(a.totalCost, 825_000);
  assert.equal(a.avgCost, 5500);
  assert.equal(a.marketValue, 900_000);
  assert.equal(a.unrealizedGain, 75_000);
  assert.equal(a.realizedGain, 75_000);
});

test("D37 fractional quantity x price is free of binary float noise", () => {
  // 2.5 * 1,234,567.89 is 3086419.7249999996 in raw floating point.
  const a = toInvestmentAccount(row({ quantity: 2.5, total_cost: 3_086_419.7, avg_cost: 1_234_567.88, current_price: 1_234_567.89 }));
  assert.equal(a.marketValue, 3_086_419.725);
  assert.equal(a.unrealizedGain, 0.025);
});

test("D38 large valid values keep exact integer precision", () => {
  const a = toInvestmentAccount(row({ quantity: 100_000, total_cost: 850_000_000_000_000, current_price: 9_000_000_000 }));
  assert.equal(a.marketValue, 900_000_000_000_000);
  assert.equal(a.unrealizedGain, 50_000_000_000_000);
  assert.ok(Number.isSafeInteger(a.marketValue as number));
});

test("D39 dates: price timestamp is ISO, trade date stays a plain YYYY-MM-DD string, nulls stay null", () => {
  const a = toInvestmentAccount(row({ price_updated_at: new Date("2026-06-01T08:30:00.000Z"), current_price: 100 }));
  assert.equal(a.priceUpdatedAt, "2026-06-01T08:30:00.000Z");
  assert.equal(a.lastTradedOn, "2026-05-10");
  assert.equal(a.createdAt, "2026-01-01T00:00:00.000Z");
  const none = toInvestmentAccount(row({ last_traded_on: null, price_updated_at: null }));
  assert.equal(none.lastTradedOn, null);
  assert.equal(none.priceUpdatedAt, null);
});

test("D40 a new price changes value and gain but never quantity, average or realized gain", () => {
  const base = rowAfter([buy(100, 5000), buy(100, 6000), sell(50, 7000)], 6000);
  const a = toInvestmentAccount(base);
  const b = toInvestmentAccount({ ...base, current_price: 8000 });
  assert.notEqual(a.marketValue, b.marketValue);
  assert.equal(b.marketValue, 1_200_000);
  assert.equal(b.unrealizedGain, 375_000);
  for (const k of ["quantity", "avgCost", "totalCost", "realizedGain"] as const) assert.equal(b[k], a[k], k);
});
