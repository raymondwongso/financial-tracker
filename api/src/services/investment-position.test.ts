import assert from "node:assert/strict";
import { test } from "node:test";
import { AppError } from "../errors.js";
import { CreateInvestmentTransactionService } from "./create-investment-transaction.service.js";
import {
  MAX_AMOUNT,
  MAX_QUANTITY,
  applyTrade,
  averageCost,
  replayTrades,
  type Position,
  type Trade,
} from "./investment-position.js";

const empty: Position = { quantity: 0, totalCost: 0, realizedGain: 0 };
const buy = (quantity: number, unitPrice: number): Trade => ({ side: "buy", quantity, unitPrice });
const sell = (quantity: number, unitPrice: number): Trade => ({ side: "sell", quantity, unitPrice });
const run = (trades: Trade[], start: Position = empty): Position => trades.reduce(applyTrade, start);

const isBadRequest = (e: unknown) => e instanceof AppError && e.statusCode === 400;

// ---------------------------------------------------------------------------
// A. Quantity and average buy price
// ---------------------------------------------------------------------------

test("A1 single buy: quantity, cost and average equal the trade", () => {
  const p = run([buy(10, 5000)]);
  assert.deepEqual(p, { quantity: 10, totalCost: 50_000, realizedGain: 0 });
  assert.equal(averageCost(p), 5000);
});

test("A2 two equal buys average to the midpoint (100@5000 + 100@6000 = 5500)", () => {
  const p = run([buy(100, 5000), buy(100, 6000)]);
  assert.equal(p.quantity, 200);
  assert.equal(p.totalCost, 1_100_000);
  assert.equal(averageCost(p), 5500);
});

test("A3 average is weighted by quantity, not a simple mean", () => {
  assert.equal(averageCost(run([buy(300, 5000), buy(100, 6000)])), 5250);
});

test("A4 many buys: average = sum(q*p) / sum(q)", () => {
  const buys = [buy(10, 100), buy(20, 130), buy(5, 90), buy(65, 110)];
  const p = run(buys);
  const cost = buys.reduce((s, b) => s + b.quantity * b.unitPrice, 0);
  assert.equal(p.quantity, 100);
  assert.equal(p.totalCost, cost);
  assert.equal(averageCost(p), cost / 100);
});

test("A5 with only buys the order does not matter", () => {
  const buys = [buy(3, 100), buy(7, 250), buy(0.5, 90.5), buy(12, 33.33)];
  const permutations = [[0, 1, 2, 3], [3, 2, 1, 0], [2, 0, 3, 1], [1, 3, 0, 2]];
  const results = permutations.map((order) => run(order.map((i) => buys[i]!)));
  for (const r of results) assert.deepEqual(r, results[0]);
});

test("A6 fractional gold grams", () => {
  const p = run([buy(2.5, 1_234_567.89)]);
  assert.equal(p.quantity, 2.5);
  assert.equal(p.totalCost, 3_086_419.725);
  assert.equal(averageCost(p), 1_234_567.89);
});

test("A6b the smallest quantity (0.000001) is stored; cost is rounded to 6 decimals", () => {
  const p = run([buy(0.000001, 1_234_567.89)]);
  assert.equal(p.quantity, 0.000001);
  // 1.23456789 -> 1.234568: dust positions carry up to 5e-7 IDR of rounding in total cost.
  assert.equal(p.totalCost, 1.234568);
});

test("A7 non-terminating average (1@100 + 2@101) keeps the exact total cost", () => {
  const p = run([buy(1, 100), buy(2, 101)]);
  assert.equal(p.totalCost, 302);
  assert.equal(averageCost(p), 100.666667);
});

test("A8 a partial sell keeps the average and shrinks quantity and cost proportionally", () => {
  const held = run([buy(100, 5000), buy(100, 6000)]);
  const p = applyTrade(held, sell(50, 9999));
  assert.equal(p.quantity, 150);
  assert.equal(p.totalCost, 825_000);
  assert.equal(averageCost(p), 5500);
});

test("A9 selling the remainder after a non-terminating partial sell leaves no residual cost", () => {
  const afterFirst = run([buy(1, 100), buy(2, 101), sell(1, 110)]);
  assert.equal(afterFirst.quantity, 2);
  assert.equal(afterFirst.totalCost, 201.333333);
  assert.equal(afterFirst.realizedGain, 9.333333);
  const cleared = applyTrade(afterFirst, sell(2, 110));
  assert.equal(cleared.quantity, 0);
  assert.equal(cleared.totalCost, 0);
});

test("A10 selling everything gives quantity 0, cost 0 and an average of 0 (no NaN)", () => {
  const p = run([buy(3, 100), sell(3, 120)]);
  assert.equal(p.quantity, 0);
  assert.equal(p.totalCost, 0);
  assert.equal(averageCost(p), 0);
  assert.ok(!Number.isNaN(averageCost(empty)));
});

test("A11 buying after a full sell starts a fresh average", () => {
  const p = run([buy(100, 5000), sell(100, 5000), buy(10, 8000)]);
  assert.equal(averageCost(p), 8000);
  assert.equal(p.quantity, 10);
  assert.equal(p.totalCost, 80_000);
});

test("A12 over-selling is rejected: more than held, from empty, by the smallest unit; exactly held is fine", () => {
  const held = run([buy(10, 100)]);
  assert.throws(() => applyTrade(held, sell(11, 100)), isBadRequest);
  assert.throws(() => applyTrade(held, sell(10.000001, 100)), isBadRequest);
  assert.throws(() => applyTrade(empty, sell(0.000001, 100)), isBadRequest);
  assert.equal(applyTrade(held, sell(10, 100)).quantity, 0);
});

test("A13 float noise in the held quantity (0.1 + 0.2) still allows selling 0.3", () => {
  const held = run([buy(0.1, 1000), buy(0.2, 1000)]);
  assert.equal(held.quantity, 0.3);
  const p = applyTrade(held, sell(0.3, 1000));
  assert.equal(p.quantity, 0);
  assert.equal(p.totalCost, 0);
});

test("A14 order matters once there are sells; same-day trades apply in entry order", () => {
  const a = run([buy(100, 5000), sell(100, 5000), buy(100, 6000)]);
  const b = run([buy(100, 5000), buy(100, 6000), sell(100, 5000)]);
  assert.equal(averageCost(a), 6000);
  assert.equal(averageCost(b), 5500);
  const sameDay = run([buy(100, 100), sell(100, 120), buy(100, 200)]);
  assert.equal(averageCost(sameDay), 200);
  assert.equal(sameDay.realizedGain, 2000);
});

test("A16 selling 0.9999996 of 1 does not leave residual cost on an empty position", () => {
  // Regression: remaining quantity rounded to 0 but 0.44 of cost used to stay behind.
  const held = run([buy(1, 1_100_000)]);
  const p = applyTrade(held, sell(0.9999996, 1_200_000));
  assert.equal(p.quantity, 0);
  assert.equal(p.totalCost, 0);
  // proceeds 0.9999996 * 1,200,000 = 1,199,999.52 against the full cost of 1,100,000
  assert.equal(p.realizedGain, 99_999.52);
});

test("A17 trades beyond the supported maximum are rejected and leave the position unchanged", () => {
  const held = run([buy(10, 100)]);
  const before = { ...held };
  assert.throws(() => applyTrade(held, buy(1_000_000, 1_000_000_000)), isBadRequest); // cost 1e15 > max
  assert.throws(() => applyTrade(held, buy(MAX_QUANTITY, 0.01)), isBadRequest); // quantity > max
  assert.throws(() => applyTrade(held, sell(10, 1e15)), isBadRequest); // realized gain > max
  assert.deepEqual(held, before);
  // Exactly at the limit is allowed and stays an exact integer.
  const atMax = applyTrade(empty, buy(1, MAX_AMOUNT));
  assert.equal(atMax.totalCost, MAX_AMOUNT);
  assert.ok(Number.isSafeInteger(atMax.totalCost));
});

test("A18 applyTrade does not mutate its input, even a frozen one", () => {
  const held = Object.freeze({ quantity: 10, totalCost: 1000, realizedGain: 5 });
  const next = applyTrade(held, sell(4, 150));
  assert.notEqual(next, held);
  assert.deepEqual(held, { quantity: 10, totalCost: 1000, realizedGain: 5 });
  assert.throws(() => applyTrade(held, sell(11, 150)), isBadRequest);
  assert.deepEqual(held, { quantity: 10, totalCost: 1000, realizedGain: 5 });
});

// A15 and the service-level side of A17: input validation happens before the position is touched.
function txService(state: Position & { lastTradedOn: string | null }) {
  const saved: Position[] = [];
  const svc = new CreateInvestmentTransactionService(
    {
      record: async (accountId, _userId, tx, decide) => {
        saved.push(decide(state));
        return { id: 1, investmentAccountId: accountId, ...tx, createdAt: "x" };
      },
    },
    () => "2026-06-01",
  );
  return { svc, saved };
}
const req = { side: "buy" as const, tradedOn: "2026-05-01", quantity: 1, unitPrice: 10 };

test("A15 quantity with more than 6 decimals and price with more than 2 decimals are rejected", async () => {
  const { svc, saved } = txService({ ...empty, lastTradedOn: null });
  const bad = (p: Promise<unknown>) => assert.rejects(p, isBadRequest);
  await bad(svc.execute(1, 1, { ...req, quantity: 0.1234567 }));
  await bad(svc.execute(1, 1, { ...req, quantity: 0.0000001 }));
  await bad(svc.execute(1, 1, { ...req, unitPrice: 100.123 }));
  assert.equal(saved.length, 0);
  // Exactly at the column precision is accepted.
  await svc.execute(1, 1, { ...req, quantity: 0.123456, unitPrice: 100.12 });
  await svc.execute(1, 1, { ...req, quantity: 2.5, unitPrice: 1_234_567.89 });
  assert.equal(saved.length, 2);
});

test("A17b the service answers 400 (not a DB error) when the amount is too large", async () => {
  const { svc, saved } = txService({ ...empty, lastTradedOn: null });
  await assert.rejects(svc.execute(1, 1, { ...req, quantity: 1_000_000, unitPrice: 1_000_000_000 }), isBadRequest);
  assert.equal(saved.length, 0);
});

// ---------------------------------------------------------------------------
// B. Realized gain
// ---------------------------------------------------------------------------

test("B19 selling above the average gives a positive gain of q*(p-avg)", () => {
  const p = run([buy(100, 5000), buy(100, 6000), sell(50, 7000)]);
  assert.equal(p.realizedGain, 75_000);
});

test("B20 selling below the average gives a negative gain", () => {
  const p = run([buy(100, 5000), buy(100, 6000), sell(40, 5000)]);
  assert.equal(p.realizedGain, -20_000);
});

test("B21 selling exactly at the average realizes nothing", () => {
  assert.equal(run([buy(100, 5000), buy(100, 6000), sell(10, 5500)]).realizedGain, 0);
});

test("B22 several partial sells accumulate", () => {
  const p = run([buy(100, 100), sell(10, 110), sell(20, 90), sell(30, 130)]);
  assert.equal(p.realizedGain, 100 - 200 + 900);
  assert.equal(p.quantity, 40);
});

test("B23 realized gain survives a full sell and later buys", () => {
  const afterSell = run([buy(10, 100), sell(10, 150)]);
  assert.equal(afterSell.realizedGain, 500);
  const later = run([buy(5, 400)], afterSell);
  assert.equal(later.realizedGain, 500);
  assert.equal(later.quantity, 5);
});

test("B24 each sell realizes against the average at that moment", () => {
  const first = run([buy(100, 100), sell(50, 150)]);
  assert.equal(first.realizedGain, 2500);
  const second = run([buy(100, 200), sell(50, 250)], first);
  // qty 150, cost 25,000 -> avg 166.666667; costRemoved 8,333.333333; proceeds 12,500
  assert.equal(second.quantity, 100);
  assert.equal(second.realizedGain, 6666.666667);
});

test("B25 buys never change the realized gain", () => {
  const p = run([buy(10, 100), sell(5, 120)]);
  const q = run([buy(1, 1), buy(1000, 99999), buy(0.5, 3)], p);
  assert.equal(q.realizedGain, p.realizedGain);
});

test("B26 fractional sale of gold is exact to 6 decimals", () => {
  const p = run([buy(2, 1_000_000), sell(0.5, 1_200_000)]);
  assert.equal(p.realizedGain, 100_000);
  const odd = run([buy(3, 1_000_001), sell(0.333333, 1_100_000)]);
  // costRemoved = 3,000,003 * 0.333333 / 3 = 333,333.333… -> realized = 366,666.3 - 333,333.333…
  assert.equal(odd.realizedGain, 33_332.966667);
});

// ---------------------------------------------------------------------------
// C. Properties on random sequences, checked against an exact reference
// ---------------------------------------------------------------------------

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Frac = { n: bigint; d: bigint };
const gcd = (a: bigint, b: bigint): bigint => (b === 0n ? (a < 0n ? -a : a) : gcd(b, a % b));
const frac = (n: bigint, d = 1n): Frac => {
  const g = gcd(n, d) || 1n;
  const s = d < 0n ? -1n : 1n;
  return { n: (s * n) / g, d: (s * d) / g };
};
const add = (a: Frac, b: Frac) => frac(a.n * b.d + b.n * a.d, a.d * b.d);
const sub = (a: Frac, b: Frac) => frac(a.n * b.d - b.n * a.d, a.d * b.d);
const mul = (a: Frac, b: Frac) => frac(a.n * b.n, a.d * b.d);
const div = (a: Frac, b: Frac) => frac(a.n * b.d, a.d * b.n);
const toNumber = (f: Frac, scale: number) => Number(f.n) / Number(f.d) / scale;

/** Exact moving-average reference in integers: quantity in micro-units, price in cents, cost/gain in micro*cent. */
class Reference {
  qty = 0n;
  cost: Frac = frac(0n);
  realized: Frac = frac(0n);
  buyCost = 0n; // sum of buy q*p
  proceeds = 0n; // sum of sell q*p
  apply(side: "buy" | "sell", qMicro: bigint, pCents: bigint) {
    const value = qMicro * pCents;
    if (side === "buy") {
      this.qty += qMicro;
      this.cost = add(this.cost, frac(value));
      this.buyCost += value;
      return;
    }
    const removed = this.qty === qMicro ? this.cost : div(mul(this.cost, frac(qMicro)), frac(this.qty));
    this.realized = add(this.realized, sub(frac(value), removed));
    this.cost = sub(this.cost, removed);
    this.qty -= qMicro;
    this.proceeds += value;
  }
}

const SEQUENCES = 200;
const STEPS = 30;
const TOL = 1e-3;

test("C27-C32 random buy/sell sequences hold their invariants and match an exact reference", () => {
  for (let seed = 1; seed <= SEQUENCES; seed++) {
    const rand = mulberry32(seed);
    const ref = new Reference();
    let pos = empty;
    let minBuy = Infinity;
    let maxBuy = -Infinity;
    const where = `seed ${seed}`;

    for (let step = 0; step < STEPS; step++) {
      const pCents = BigInt(100 + Math.floor(rand() * 10_000_000));
      const price = Number(pCents) / 100;
      const held = ref.qty;
      const doSell = held > 0n && rand() < 0.4;
      let qMicro: bigint;
      let trade: Trade;
      if (doSell) {
        qMicro = rand() < 0.2 ? held : BigInt(1) + BigInt(Math.floor(rand() * Number(held)));
        if (qMicro > held) qMicro = held;
        trade = sell(Number(qMicro) / 1e6, price);
      } else {
        qMicro = BigInt(1 + Math.floor(rand() * 5_000_000));
        trade = buy(Number(qMicro) / 1e6, price);
        minBuy = Math.min(minBuy, price);
        maxBuy = Math.max(maxBuy, price);
      }

      // C32: valid sequences never throw.
      pos = applyTrade(pos, trade);
      ref.apply(trade.side, qMicro, pCents);

      // C27: quantity is exactly the net of buys and sells, never negative.
      assert.equal(Math.round(pos.quantity * 1e6), Number(ref.qty), `${where} step ${step}: quantity`);
      assert.ok(pos.quantity >= 0, `${where}: quantity >= 0`);
      // C28: an empty position carries no cost.
      if (pos.quantity === 0) assert.equal(pos.totalCost, 0, `${where} step ${step}: empty => no cost`);
      // C29: totalCost - realizedGain = sum(buys) - sum(sell proceeds).
      const expectedFlow = Number(ref.buyCost - ref.proceeds) / 1e8;
      assert.ok(
        Math.abs(pos.totalCost - pos.realizedGain - expectedFlow) < TOL,
        `${where} step ${step}: accounting identity`,
      );
      // C30: the average always lies between the cheapest and dearest buy (tolerance covers the 6-decimal cost rounding).
      if (pos.quantity > 0) {
        const tol = TOL / pos.quantity + 1e-6;
        const avg = pos.totalCost / pos.quantity;
        assert.ok(avg >= minBuy - tol && avg <= maxBuy + tol, `${where} step ${step}: avg ${avg} in [${minBuy}, ${maxBuy}]`);
      }
      // C31: cost and realized gain match the exact reference.
      assert.ok(Math.abs(pos.totalCost - toNumber(ref.cost, 1e8)) < TOL, `${where} step ${step}: cost vs reference`);
      assert.ok(Math.abs(pos.realizedGain - toNumber(ref.realized, 1e8)) < TOL, `${where} step ${step}: realized vs reference`);
    }
  }
});

test("replayTrades of nothing is the empty position", () => {
  assert.deepEqual(replayTrades([]), empty);
});

test("replayTrades equals applying the trades one by one", () => {
  const trades = [buy(100, 5000), buy(100, 6000), sell(50, 7000)];
  assert.deepEqual(replayTrades(trades), trades.reduce(applyTrade, empty));
});

test("replayTrades throws when a sell exceeds the quantity held", () => {
  assert.throws(
    () => replayTrades([sell(8, 100), buy(5, 100)]),
    (e: unknown) => e instanceof AppError && e.statusCode === 400,
  );
});
