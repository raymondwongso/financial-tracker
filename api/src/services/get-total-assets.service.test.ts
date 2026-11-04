import assert from "node:assert/strict";
import { test } from "node:test";
import type { AccountWithBalance, InvestmentAccount } from "@financialtracker/shared";
import { GetTotalAssetsService } from "./get-total-assets.service.js";

const account = (balance: number): AccountWithBalance => ({
  id: 1, name: "BCA", description: "", initialBalance: 0, createdAt: "2026-01-01T00:00:00.000Z",
  balance, lastTransactionAt: null,
});

const position = (o: Partial<InvestmentAccount> = {}): InvestmentAccount => ({
  id: 1, name: "BBCA", assetType: "stock", symbol: "BBCA", unit: "share", quantity: 100, totalCost: 500_000,
  avgCost: 5000, realizedGain: 0, lastTradedOn: null, currentPrice: 6000, priceUpdatedAt: null,
  marketValue: 600_000, unrealizedGain: 100_000, createdAt: "2026-01-01T00:00:00.000Z", ...o,
});

const service = (accounts: AccountWithBalance[], positions: InvestmentAccount[]) =>
  new GetTotalAssetsService({ listByUser: async () => accounts }, { listByUser: async () => positions });

test("sums account balances and priced investment market value", async () => {
  const r = await service([account(1_000_000), account(500_000)], [position(), position({ id: 2, marketValue: 400_000 })]).execute(1);
  assert.deepEqual(r, { total: 2_500_000, accountsTotal: 1_500_000, investmentsTotal: 1_000_000, unpricedInvestmentCount: 0 });
});

test("a user with nothing has zero assets", async () => {
  assert.deepEqual(await service([], []).execute(1), {
    total: 0, accountsTotal: 0, investmentsTotal: 0, unpricedInvestmentCount: 0,
  });
});

test("a negative account balance reduces the total", async () => {
  const r = await service([account(-200_000), account(1_000_000)], []).execute(1);
  assert.equal(r.accountsTotal, 800_000);
  assert.equal(r.total, 800_000);
});

test("held positions without a price are excluded and counted", async () => {
  const r = await service([account(100)], [position(), position({ id: 2, currentPrice: null, marketValue: null })]).execute(1);
  assert.equal(r.investmentsTotal, 600_000);
  assert.equal(r.unpricedInvestmentCount, 1);
  assert.equal(r.total, 600_100);
});

test("fully sold positions are ignored even without a price", async () => {
  const r = await service([], [position({ quantity: 0, totalCost: 0, currentPrice: null, marketValue: null })]).execute(1);
  assert.equal(r.unpricedInvestmentCount, 0);
  assert.equal(r.investmentsTotal, 0);
});
