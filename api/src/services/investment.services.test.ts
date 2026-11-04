import assert from "node:assert/strict";
import { test } from "node:test";
import type { InvestmentAccount } from "@financialtracker/shared";
import { AppError } from "../errors.js";
import { CreateInvestmentAccountService } from "./create-investment-account.service.js";
import { DeleteInvestmentAccountService } from "./delete-investment-account.service.js";
import { DeleteInvestmentTransactionService } from "./delete-investment-transaction.service.js";
import { CreateInvestmentTransactionService } from "./create-investment-transaction.service.js";
import { applyTrade, averageCost, type Position, type Trade } from "./investment-position.js";
import { GetInvestmentAccountService } from "./get-investment-account.service.js";
import { ListInvestmentAccountsService } from "./list-investment-accounts.service.js";
import { ListInvestmentPriceHistoryService } from "./list-investment-price-history.service.js";
import { SetInvestmentPriceService } from "./set-investment-price.service.js";

async function rejects(p: Promise<unknown>, status: number) {
  await assert.rejects(p, (e: unknown) => e instanceof AppError && e.statusCode === status);
}

const empty: Position = { quantity: 0, totalCost: 0, realizedGain: 0 };
const buy = (quantity: number, unitPrice: number) => ({ side: "buy" as const, quantity, unitPrice });
const sell = (quantity: number, unitPrice: number) => ({ side: "sell" as const, quantity, unitPrice });

test("average of 100@5000 and 100@6000 is 5500", () => {
  const p = applyTrade(applyTrade(empty, buy(100, 5000)), buy(100, 6000));
  assert.equal(p.quantity, 200);
  assert.equal(p.totalCost, 1_100_000);
  assert.equal(averageCost(p), 5500);
});

test("average is weighted by quantity", () => {
  const p = applyTrade(applyTrade(empty, buy(300, 5000)), buy(100, 6000));
  assert.equal(averageCost(p), 5250);
});

test("sell keeps the average and realizes the difference", () => {
  const held = applyTrade(applyTrade(empty, buy(100, 5000)), buy(100, 6000));
  const p = applyTrade(held, sell(50, 7000));
  assert.equal(p.quantity, 150);
  assert.equal(averageCost(p), 5500);
  assert.equal(p.realizedGain, 75_000);
});

test("selling everything resets cost and average", () => {
  const p = applyTrade(applyTrade(empty, buy(3, 100)), sell(3, 120));
  assert.equal(p.quantity, 0);
  assert.equal(p.totalCost, 0);
  assert.equal(averageCost(p), 0);
  assert.equal(p.realizedGain, 60);
});

test("fractional quantities (gold grams) and non-terminating averages stay consistent", () => {
  const p = applyTrade(applyTrade(empty, buy(1, 100)), buy(2, 101));
  assert.equal(p.totalCost, 302);
  assert.equal(averageCost(p), 100.666667);
  const g = applyTrade(empty, buy(2.5, 1_000_000));
  assert.equal(g.totalCost, 2_500_000);
});

test("order matters with sells (why dates must be chronological)", () => {
  const a = applyTrade(applyTrade(applyTrade(empty, buy(100, 5000)), sell(100, 5000)), buy(100, 6000));
  const b = applyTrade(applyTrade(applyTrade(empty, buy(100, 5000)), buy(100, 6000)), sell(100, 5000));
  assert.equal(averageCost(a), 6000);
  assert.equal(averageCost(b), 5500);
});

test("selling more than held is rejected", () => {
  assert.throws(
    () => applyTrade(applyTrade(empty, buy(10, 100)), sell(11, 100)),
    (e: unknown) => e instanceof AppError && e.statusCode === 400,
  );
  assert.throws(() => applyTrade(empty, sell(1, 100)), AppError);
});

function txService(state: { quantity: number; totalCost: number; realizedGain: number; lastTradedOn: string | null } | null) {
  const saved: unknown[] = [];
  const svc = new CreateInvestmentTransactionService(
    {
      record: async (accountId, userId, tx, decide) => {
        if (!state || userId !== 1) return null;
        const next = decide(state);
        saved.push(next);
        return { id: 1, investmentAccountId: accountId, ...tx, createdAt: "x" };
      },
    },
    () => "2026-06-01",
  );
  return { svc, saved };
}
const body = { side: "buy" as const, tradedOn: "2026-05-01", quantity: 1, unitPrice: 10 };

test("create transaction validates input", async () => {
  const { svc } = txService({ ...empty, lastTradedOn: null });
  await rejects(svc.execute(1, 1, { ...body, tradedOn: "2026-13-45" }), 400);
  await rejects(svc.execute(1, 1, { ...body, tradedOn: "05/01/2026" }), 400);
  await rejects(svc.execute(1, 1, { ...body, tradedOn: "2026-06-02" }), 400);
  await rejects(svc.execute(1, 1, { ...body, quantity: 0 }), 400);
  await rejects(svc.execute(1, 1, { ...body, unitPrice: -1 }), 400);
});

test("create transaction rejects dates before the last transaction, allows same day", async () => {
  const { svc, saved } = txService({ ...empty, lastTradedOn: "2026-05-10" });
  await rejects(svc.execute(1, 1, { ...body, tradedOn: "2026-05-09" }), 400);
  await svc.execute(1, 1, { ...body, tradedOn: "2026-05-10" });
  assert.equal(saved.length, 1);
});

test("create transaction rejects over-sell and is owner scoped", async () => {
  const { svc } = txService({ quantity: 5, totalCost: 50, realizedGain: 0, lastTradedOn: null });
  await rejects(svc.execute(1, 1, { ...body, side: "sell", quantity: 6 }), 400);
  await rejects(svc.execute(2, 1, body), 404);
  const none = txService(null);
  await rejects(none.svc.execute(1, 9, body), 404);
});

const inv = (o: Partial<InvestmentAccount>): InvestmentAccount => ({
  id: 1, name: "BBCA", assetType: "stock", symbol: "BBCA", unit: "share", quantity: 0, totalCost: 0,
  avgCost: 0, realizedGain: 0, lastTradedOn: null, currentPrice: null, priceUpdatedAt: null,
  marketValue: null, unrealizedGain: null, createdAt: "x", ...o,
});

test("create investment account: gold is fixed to GOLD/gram, stock needs a ticker, duplicates are 409", async () => {
  const created: unknown[] = [];
  const svc = new CreateInvestmentAccountService({
    create: async (a) => {
      created.push(a);
      return inv({ name: a.name, symbol: a.symbol, unit: a.unit, assetType: a.assetType });
    },
  });
  await svc.execute(1, { name: " Antam ", assetType: "gold", symbol: "ignored" });
  await svc.execute(1, { name: "BCA", assetType: "stock", symbol: " bbca " });
  assert.deepEqual(created, [
    { userId: 1, name: "Antam", assetType: "gold", symbol: "GOLD", unit: "gram" },
    { userId: 1, name: "BCA", assetType: "stock", symbol: "BBCA", unit: "share" },
  ]);
  await rejects(svc.execute(1, { name: "x", assetType: "stock" }), 400);
  await rejects(svc.execute(1, { name: " ", assetType: "gold" }), 400);
  const dup = new CreateInvestmentAccountService({
    create: async () => {
      throw Object.assign(new Error("dup"), { code: "23505" });
    },
  });
  await rejects(dup.execute(1, { name: "x", assetType: "gold" }), 409);
});

test("get/set price are owner scoped; price must be positive", async () => {
  const get = new GetInvestmentAccountService({ findByIdForUser: async (id, uid) => (uid === 1 ? inv({ id }) : null) });
  assert.equal((await get.execute(1, 3)).id, 3);
  await rejects(get.execute(2, 3), 404);
  const set = new SetInvestmentPriceService({
    setPrice: async (id, uid, price) => (uid === 1 ? inv({ id, currentPrice: price }) : null),
  });
  assert.equal((await set.execute(1, 3, 6500)).currentPrice, 6500);
  await rejects(set.execute(2, 3, 6500), 404);
  await rejects(set.execute(1, 3, 0), 400);
});

test("list summary totals value only when every held position is priced", async () => {
  const priced = inv({ id: 1, quantity: 200, totalCost: 1_100_000, currentPrice: 6500, marketValue: 1_300_000, unrealizedGain: 200_000 });
  const ok = await new ListInvestmentAccountsService({ listByUser: async () => [priced] }).execute(1);
  assert.deepEqual(ok.summary, { totalCost: 1_100_000, totalValue: 1_300_000, unrealizedGain: 200_000 });
  const unpriced = inv({ id: 2, quantity: 10, totalCost: 100 });
  const part = await new ListInvestmentAccountsService({ listByUser: async () => [priced, unpriced] }).execute(1);
  assert.deepEqual(part.summary, { totalCost: 1_100_100, totalValue: null, unrealizedGain: null });
  const none = await new ListInvestmentAccountsService({ listByUser: async () => [] }).execute(1);
  assert.deepEqual(none.summary, { totalCost: 0, totalValue: 0, unrealizedGain: 0 });
});

test("list forwards the sort query to the repository and leaves the summary unchanged", async () => {
  const items = [priced(1, 200, 1_100_000, 6500), priced(2, 10, 500_000, 70_000)];
  const seen: unknown[] = [];
  const svc = new ListInvestmentAccountsService({
    listByUser: async (_userId, sort) => {
      seen.push(sort);
      return items;
    },
  });
  const plain = await svc.execute(1);
  const sorted = await svc.execute(1, { sortBy: "value", order: "desc" });
  assert.deepEqual(seen, [{}, { sortBy: "value", order: "desc" }]);
  assert.deepEqual(sorted.summary, plain.summary);
  assert.deepEqual(sorted.items, items);
});

const priced = (id: number, quantity: number, totalCost: number, price: number): InvestmentAccount =>
  inv({
    id, quantity, totalCost, currentPrice: price,
    marketValue: quantity * price, unrealizedGain: quantity * price - totalCost,
  });

test("E41 summary sums cost and value across several priced accounts", async () => {
  const items = [priced(1, 200, 1_100_000, 6500), priced(2, 10, 500_000, 70_000), priced(3, 5, 100, 20)];
  const { summary } = await new ListInvestmentAccountsService({ listByUser: async () => items }).execute(1);
  assert.deepEqual(summary, { totalCost: 1_600_100, totalValue: 2_000_100, unrealizedGain: 400_000 });
});

test("E42 gains and losses net out in the portfolio gain", async () => {
  const items = [priced(1, 100, 1_000_000, 12_000), priced(2, 100, 1_000_000, 8_000)];
  const { summary } = await new ListInvestmentAccountsService({ listByUser: async () => items }).execute(1);
  assert.equal(summary.unrealizedGain, 0);
  assert.equal(summary.totalValue, 2_000_000);
  const loss = await new ListInvestmentAccountsService({ listByUser: async () => [priced(1, 100, 1_000_000, 5_000)] }).execute(1);
  assert.equal(loss.summary.unrealizedGain, -500_000);
});

test("E44 a fully sold unpriced account does not make the portfolio value unknown", async () => {
  const sold = inv({ id: 2, quantity: 0, totalCost: 0, realizedGain: 500 });
  const items = [priced(1, 200, 1_100_000, 6500), sold];
  const { summary } = await new ListInvestmentAccountsService({ listByUser: async () => items }).execute(1);
  assert.deepEqual(summary, { totalCost: 1_100_000, totalValue: 1_300_000, unrealizedGain: 200_000 });
});

type RemoveFn = (a: number, u: number, t: number, d: (r: Trade[]) => Position) => Promise<boolean>;

test("delete investment transaction: 404 when the repository finds nothing", async () => {
  const svc = new DeleteInvestmentTransactionService({ remove: async () => false });
  await rejects(svc.execute(1, 1, 9), 404);
});

test("delete investment transaction: passes the replayed position to the repository", async () => {
  let got: Position | undefined;
  const remove: RemoveFn = async (_a, _u, _t, decide) => {
    got = decide([buy(10, 100), sell(4, 150)]);
    return true;
  };
  await new DeleteInvestmentTransactionService({ remove }).execute(1, 1, 9);
  assert.deepEqual(got, { quantity: 6, totalCost: 600, realizedGain: 200 });
});

test("delete investment transaction: an invalid remaining history is rejected with 400 and a reason", async () => {
  const remove: RemoveFn = async (_a, _u, _t, decide) => {
    decide([sell(8, 100)]);
    return true;
  };
  await assert.rejects(
    new DeleteInvestmentTransactionService({ remove }).execute(1, 1, 9),
    (e: unknown) =>
      e instanceof AppError && e.statusCode === 400 && /Can't delete.*quantity held/.test(e.message),
  );
});

test("set price: defaults to today, accepts past dates, rejects future/malformed dates and >2 decimals", async () => {
  const seen: string[] = [];
  const set = new SetInvestmentPriceService(
    { setPrice: async (id, _uid, price, date) => (seen.push(date), inv({ id, currentPrice: price })) },
    () => "2026-11-04",
  );
  await set.execute(1, 3, 6500);
  await set.execute(1, 3, 6500, "2026-11-04");
  await set.execute(1, 3, 6500, "2026-01-02");
  assert.deepEqual(seen, ["2026-11-04", "2026-11-04", "2026-01-02"]);
  await rejects(set.execute(1, 3, 6500, "2026-11-05"), 400);
  await rejects(set.execute(1, 3, 6500, "2026-1-5"), 400);
  await rejects(set.execute(1, 3, 6500, "2026-13-45"), 400);
  await rejects(set.execute(1, 3, 6500.123), 400);
  assert.equal(seen.length, 3);
});

test("price history is owner scoped and returns the repository's points", async () => {
  const points = [{ date: "2026-05-01", price: 100 }, { date: "2026-05-02", price: 110 }];
  const svc = new ListInvestmentPriceHistoryService(
    { findByIdForUser: async (id, uid) => (uid === 1 ? inv({ id }) : null) },
    { listByAccount: async () => points },
  );
  assert.deepEqual(await svc.execute(1, 3), points);
  await rejects(svc.execute(2, 3), 404);
});

test("delete investment account is scoped to the owner and 404s when nothing matched", async () => {
  const calls: [number, number][] = [];
  const svc = new DeleteInvestmentAccountService({
    delete: async (id, uid) => {
      calls.push([id, uid]);
      return uid === 1;
    },
  });
  await svc.execute(1, 7);
  assert.deepEqual(calls, [[7, 1]]);
  await rejects(svc.execute(2, 7), 404);
});
