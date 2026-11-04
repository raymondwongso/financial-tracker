// DB-backed checks for what unit tests cannot see: the generated avg_cost column, row locking,
// rollback, and column limits. Needs a reachable Postgres (DATABASE_URL, default: the dev DB from
// `make api-docker-up`). It creates a throwaway database and drops it afterwards; it never touches
// your data. If Postgres is not reachable the suite FAILS with a clear message (it is not skipped).
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import pg from "pg";
import { loadConfig } from "../../config.js";
import { AppError } from "../../errors.js";
import { DeleteInvestmentTransactionService } from "../../services/delete-investment-transaction.service.js";
import { CreateInvestmentTransactionService } from "../../services/create-investment-transaction.service.js";
import { InvestmentAccountRepository } from "./investment-account.repository.js";
import { InvestmentTransactionRepository } from "./investment-transaction.repository.js";
import { InvestmentPriceRepository } from "./investment-price.repository.js";
import { createPool } from "./pool.js";
import { TransactionRepository } from "./transaction.repository.js";

const migrationsDir = join(import.meta.dirname, "..", "..", "..", "db", "migrations");
const dbName = `kas_test_${process.pid}_${Date.now()}`;

let admin: pg.Client;
let pool: pg.Pool;
let accounts: InvestmentAccountRepository;
let txRepo: InvestmentTransactionRepository;
let svc: CreateInvestmentTransactionService;
let userId: number;
let otherUserId: number;
let seq = 0;

async function newAccount(name = `acc${++seq}`, owner = userId) {
  return accounts.create({ userId: owner, name, assetType: "stock", symbol: "BBCA", unit: "share" });
}
const trade = (side: "buy" | "sell", tradedOn: string, quantity: number, unitPrice: number) =>
  ({ side, tradedOn, quantity, unitPrice }) as const;

describe("investment repositories against a real Postgres", () => {
  before(async () => {
    const config = loadConfig();
    const adminUrl = new URL(config.databaseUrl);
    adminUrl.pathname = "/postgres";
    admin = new pg.Client({ connectionString: adminUrl.toString() });
    try {
      await admin.connect();
    } catch (err) {
      throw new Error(
        `Investment DB tests need Postgres at ${adminUrl.host} (set DATABASE_URL or run \`make api-docker-up\`): ${(err as Error).message}`,
      );
    }
    await admin.query(`CREATE DATABASE ${dbName}`);
    const testUrl = new URL(config.databaseUrl);
    testUrl.pathname = `/${dbName}`;
    pool = createPool({ ...config, databaseUrl: testUrl.toString() });
    for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort()) {
      await pool.query(readFileSync(join(migrationsDir, file), "utf8"));
    }
    const mkUser = async (email: string) =>
      (await pool.query<{ id: number }>(
        "INSERT INTO users (email, first_name, last_name, password_hash) VALUES ($1, 'T', 'U', 'x') RETURNING id",
        [email],
      )).rows[0]!.id;
    userId = await mkUser("owner@test.io");
    otherUserId = await mkUser("other@test.io");
    accounts = new InvestmentAccountRepository(pool);
    txRepo = new InvestmentTransactionRepository(pool);
    svc = new CreateInvestmentTransactionService(txRepo, () => "2026-12-31");
  });

  after(async () => {
    await pool?.end();
    if (admin) {
      // pool.end() resolves before the server has reaped every backend, and FORCE would kill them
      // mid-close (surfacing as an error on the client). Retry a plain DROP until they are gone.
      for (let attempt = 0; ; attempt++) {
        try {
          await admin.query(`DROP DATABASE IF EXISTS ${dbName}`);
          break;
        } catch (err) {
          if ((err as { code?: string }).code !== "55006" || attempt >= 50) throw err; // 55006: in use
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }
      await admin.end();
    }
  });

  test("F46 the generated avg_cost column: 5500, a rounded non-terminating value, and 0 when empty", async () => {
    const a = await newAccount();
    assert.equal((await accounts.findByIdForUser(a.id, userId))!.avgCost, 0);
    await svc.execute(userId, a.id, trade("buy", "2026-05-01", 100, 5000));
    await svc.execute(userId, a.id, trade("buy", "2026-05-02", 100, 6000));
    assert.equal((await accounts.findByIdForUser(a.id, userId))!.avgCost, 5500);

    const b = await newAccount();
    await svc.execute(userId, b.id, trade("buy", "2026-05-01", 1, 100));
    await svc.execute(userId, b.id, trade("buy", "2026-05-02", 2, 101));
    const rb = (await accounts.findByIdForUser(b.id, userId))!;
    assert.equal(rb.avgCost, 100.666667);
    assert.equal(rb.totalCost, 302);

    await svc.execute(userId, b.id, trade("sell", "2026-05-03", 3, 120));
    const sold = (await accounts.findByIdForUser(b.id, userId))!;
    assert.equal(sold.quantity, 0);
    assert.equal(sold.totalCost, 0);
    assert.equal(sold.avgCost, 0);
  });

  test("F46b stored position matches the example end to end: value, gain, realized", async () => {
    const a = await newAccount();
    await svc.execute(userId, a.id, trade("buy", "2026-05-01", 100, 5000));
    await svc.execute(userId, a.id, trade("buy", "2026-05-02", 100, 6000));
    await accounts.setPrice(a.id, userId, 6500, "2026-05-02");
    await svc.execute(userId, a.id, trade("sell", "2026-05-03", 50, 7000));
    const r = (await accounts.findByIdForUser(a.id, userId))!;
    assert.equal(r.quantity, 150);
    assert.equal(r.avgCost, 5500);
    assert.equal(r.realizedGain, 75_000);
    assert.equal(r.marketValue, 975_000);
    assert.equal(r.unrealizedGain, 150_000);
    assert.equal(r.lastTradedOn, "2026-05-03");
  });

  test("F47 twenty concurrent buys on one account are serialised by the row lock", async () => {
    const a = await newAccount();
    await svc.execute(userId, a.id, trade("buy", "2026-05-01", 10, 100));
    await Promise.all(
      Array.from({ length: 20 }, () => svc.execute(userId, a.id, trade("buy", "2026-05-02", 1, 200))),
    );
    const r = (await accounts.findByIdForUser(a.id, userId))!;
    assert.equal(r.quantity, 30);
    assert.equal(r.totalCost, 1000 + 20 * 200);
    assert.equal((await txRepo.listByAccount(a.id)).length, 21);
  });

  test("F47b concurrent sells cannot oversell: only what is held can be sold", async () => {
    const a = await newAccount();
    await svc.execute(userId, a.id, trade("buy", "2026-05-01", 5, 100));
    const results = await Promise.allSettled(
      Array.from({ length: 10 }, () => svc.execute(userId, a.id, trade("sell", "2026-05-02", 1, 150))),
    );
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 5);
    for (const r of results) {
      if (r.status === "rejected") assert.ok(r.reason instanceof AppError && r.reason.statusCode === 400);
    }
    const r = (await accounts.findByIdForUser(a.id, userId))!;
    assert.equal(r.quantity, 0);
    assert.equal(r.totalCost, 0);
    assert.equal(r.realizedGain, 250);
  });

  test("F48 rejected backdated and over-sell requests roll back and change nothing", async () => {
    const a = await newAccount();
    await svc.execute(userId, a.id, trade("buy", "2026-05-10", 10, 100));
    const before = (await accounts.findByIdForUser(a.id, userId))!;
    await assert.rejects(svc.execute(userId, a.id, trade("buy", "2026-05-09", 1, 100)), AppError);
    await assert.rejects(svc.execute(userId, a.id, trade("sell", "2026-05-11", 11, 100)), AppError);
    assert.deepEqual(await accounts.findByIdForUser(a.id, userId), before);
    assert.equal((await txRepo.listByAccount(a.id)).length, 1);
    // The row lock was released: the next valid request still works.
    await svc.execute(userId, a.id, trade("buy", "2026-05-10", 1, 100));
    assert.equal((await accounts.findByIdForUser(a.id, userId))!.quantity, 11);
  });

  test("F49 the largest supported position persists exactly; one beyond it is a 400, not a DB error", async () => {
    const a = await newAccount();
    // 100 * 9,999,999,999,999 = 999,999,999,999,900 (just under the 1e15 limit)
    await svc.execute(userId, a.id, trade("buy", "2026-05-01", 100, 9_999_999_999_999));
    const r = (await accounts.findByIdForUser(a.id, userId))!;
    assert.equal(r.totalCost, 999_999_999_999_900);
    assert.equal(r.avgCost, 9_999_999_999_999);
    await assert.rejects(
      svc.execute(userId, a.id, trade("buy", "2026-05-02", 100, 9_999_999_999_999)),
      (e: unknown) => e instanceof AppError && e.statusCode === 400,
    );
    assert.equal((await accounts.findByIdForUser(a.id, userId))!.totalCost, 999_999_999_999_900);
  });

  test("F50 another user's account is invisible and cannot be traded on", async () => {
    const a = await newAccount();
    assert.equal(await accounts.findByIdForUser(a.id, otherUserId), null);
    assert.equal(await accounts.setPrice(a.id, otherUserId, 100, "2026-05-02"), null);
    await assert.rejects(
      svc.execute(otherUserId, a.id, trade("buy", "2026-05-01", 1, 100)),
      (e: unknown) => e instanceof AppError && e.statusCode === 404,
    );
    assert.equal((await txRepo.listByAccount(a.id)).length, 0);
  });

  test("F51 trade dates round-trip as plain YYYY-MM-DD strings", async () => {
    const a = await newAccount();
    const t = await svc.execute(userId, a.id, trade("buy", "2026-03-01", 1, 100));
    assert.equal(t.tradedOn, "2026-03-01");
    assert.equal((await txRepo.listByAccount(a.id))[0]!.tradedOn, "2026-03-01");
    assert.equal((await accounts.findByIdForUser(a.id, userId))!.lastTradedOn, "2026-03-01");
  });

  test("F52 names are unique per user, case-insensitively", async () => {
    await newAccount("Antam");
    await assert.rejects(newAccount("antam"), (e: unknown) => (e as { code?: string }).code === "23505");
    await newAccount("Antam", otherUserId);
  });

  const del = (owner: number, accountId: number, txId: number) =>
    new DeleteInvestmentTransactionService(txRepo).execute(owner, accountId, txId);

  test("D1 deleting the latest sell restores the position and last_traded_on", async () => {
    const a = await newAccount();
    await svc.execute(userId, a.id, trade("buy", "2026-05-01", 100, 5000));
    const sold = await svc.execute(userId, a.id, trade("sell", "2026-05-03", 40, 7000));
    await del(userId, a.id, sold.id);
    const r = (await accounts.findByIdForUser(a.id, userId))!;
    assert.equal(r.quantity, 100);
    assert.equal(r.totalCost, 500_000);
    assert.equal(r.realizedGain, 0);
    assert.equal(r.lastTradedOn, "2026-05-01");
    assert.equal((await txRepo.listByAccount(a.id)).length, 1);
  });

  test("D2 deleting a middle buy recomputes the average and later realized gain", async () => {
    const a = await newAccount();
    await svc.execute(userId, a.id, trade("buy", "2026-05-01", 100, 5000));
    const mid = await svc.execute(userId, a.id, trade("buy", "2026-05-02", 100, 6000));
    await svc.execute(userId, a.id, trade("sell", "2026-05-03", 50, 7000));
    await del(userId, a.id, mid.id);
    const r = (await accounts.findByIdForUser(a.id, userId))!;
    assert.equal(r.quantity, 50);
    assert.equal(r.avgCost, 5000);
    assert.equal(r.realizedGain, 100_000);
    assert.equal(r.lastTradedOn, "2026-05-03");
  });

  test("D3 deleting the only transaction resets the account to empty", async () => {
    const a = await newAccount();
    const t = await svc.execute(userId, a.id, trade("buy", "2026-05-01", 10, 100));
    await del(userId, a.id, t.id);
    const r = (await accounts.findByIdForUser(a.id, userId))!;
    assert.equal(r.quantity, 0);
    assert.equal(r.totalCost, 0);
    assert.equal(r.realizedGain, 0);
    assert.equal(r.lastTradedOn, null);
  });

  test("D4 a delete that would leave an oversell is rejected and changes nothing", async () => {
    const a = await newAccount();
    const first = await svc.execute(userId, a.id, trade("buy", "2026-05-01", 10, 100));
    await svc.execute(userId, a.id, trade("sell", "2026-05-02", 8, 150));
    await assert.rejects(
      del(userId, a.id, first.id),
      (e: unknown) => e instanceof AppError && e.statusCode === 400,
    );
    const r = (await accounts.findByIdForUser(a.id, userId))!;
    assert.equal(r.quantity, 2);
    assert.equal((await txRepo.listByAccount(a.id)).length, 2);
  });

  test("D5 unknown ids, other users and other accounts' transactions are 404", async () => {
    const a = await newAccount();
    const b = await newAccount();
    const t = await svc.execute(userId, a.id, trade("buy", "2026-05-01", 10, 100));
    for (const call of [
      () => del(userId, a.id, 999_999_999),
      () => del(otherUserId, a.id, t.id),
      () => del(userId, b.id, t.id),
    ]) {
      await assert.rejects(call(), (e: unknown) => e instanceof AppError && e.statusCode === 404);
    }
    assert.equal((await txRepo.listByAccount(a.id)).length, 1);
  });

  test("D6 account transactions: delete changes the balance and is owner-scoped", async () => {
    const q = <T extends pg.QueryResultRow>(sql: string, p: unknown[]) => pool.query<T>(sql, p);
    const acc = (await q<{ id: number }>(
      "INSERT INTO accounts (user_id, name, initial_balance) VALUES ($1, 'Bank', 1000) RETURNING id", [userId],
    )).rows[0]!.id;
    const cat = (await q<{ id: number }>(
      "INSERT INTO categories (user_id, name) VALUES ($1, 'Food') RETURNING id", [userId],
    )).rows[0]!.id;
    const mk = async (type: string, amount: number) => (await q<{ id: number }>(
      "INSERT INTO transactions (account_id, category_id, type, amount) VALUES ($1, $2, $3, $4) RETURNING id",
      [acc, cat, type, amount],
    )).rows[0]!.id;
    const expense = await mk("expense", 300);
    await mk("income", 500);
    const { AccountRepository } = await import("./account.repository.js");
    const balance = async () => (await new AccountRepository(pool).findByIdForUser(acc, userId))!.balance;
    assert.equal(await balance(), 1200);
    const repo = new TransactionRepository(pool);
    assert.equal(await repo.delete(expense, otherUserId), false);
    assert.equal(await balance(), 1200);
    assert.equal(await repo.delete(expense, userId), true);
    assert.equal(await balance(), 1500);
    assert.equal(await repo.delete(expense, userId), false);
  });

  test("D7 delete account: removes its transactions, keeps others, is owner-scoped", async () => {
    const q = <T extends pg.QueryResultRow>(sql: string, p: unknown[]) => pool.query<T>(sql, p);
    const mkAcc = async (name: string) => (await q<{ id: number }>(
      "INSERT INTO accounts (user_id, name, initial_balance) VALUES ($1, $2, 0) RETURNING id", [userId, name],
    )).rows[0]!.id;
    const cat = (await q<{ id: number }>(
      "INSERT INTO categories (user_id, name) VALUES ($1, 'Del') RETURNING id", [userId],
    )).rows[0]!.id;
    const doomed = await mkAcc("Doomed");
    const kept = await mkAcc("Kept");
    for (const a of [doomed, kept]) {
      await q("INSERT INTO transactions (account_id, category_id, type, amount) VALUES ($1, $2, 'income', 10)", [a, cat]);
    }
    const { AccountRepository } = await import("./account.repository.js");
    const repo = new AccountRepository(pool);
    assert.equal(await repo.delete(doomed, otherUserId), false);
    assert.equal((await q("SELECT 1 FROM accounts WHERE id = $1", [doomed])).rowCount, 1);
    assert.equal(await repo.delete(doomed, userId), true);
    assert.equal((await q("SELECT 1 FROM accounts WHERE id = $1", [doomed])).rowCount, 0);
    assert.equal((await q("SELECT 1 FROM transactions WHERE account_id = $1", [doomed])).rowCount, 0);
    assert.equal((await q("SELECT 1 FROM transactions WHERE account_id = $1", [kept])).rowCount, 1);
    assert.equal(await repo.delete(doomed, userId), false);
  });

  test("D8 delete investment account: removes trades and price history, keeps others, is owner-scoped", async () => {
    const prices = new InvestmentPriceRepository(pool);
    const doomed = await newAccount();
    const kept = await newAccount();
    for (const a of [doomed, kept]) {
      await svc.execute(userId, a.id, trade("buy", "2026-05-01", 10, 100));
      await accounts.setPrice(a.id, userId, 110, "2026-05-02");
    }
    assert.equal(await accounts.delete(doomed.id, otherUserId), false);
    assert.notEqual(await accounts.findByIdForUser(doomed.id, userId), null);
    assert.equal(await accounts.delete(doomed.id, userId), true);
    assert.equal(await accounts.findByIdForUser(doomed.id, userId), null);
    const count = async (table: string, id: number) =>
      (await pool.query(`SELECT 1 FROM ${table} WHERE investment_account_id = $1`, [id])).rowCount;
    assert.equal(await count("investment_transactions", doomed.id), 0);
    assert.equal(await count("investment_price_history", doomed.id), 0);
    assert.equal(await count("investment_transactions", kept.id), 1);
    assert.equal((await prices.listByAccount(kept.id)).length, 1);
    assert.equal(await accounts.delete(doomed.id, userId), false);
  });

  test("P1 price history: same-day entry overwrites, list is ascending, current price follows the latest date", async () => {
    const prices = new InvestmentPriceRepository(pool);
    const a = await newAccount();
    await accounts.setPrice(a.id, userId, 100, "2026-05-02");
    await accounts.setPrice(a.id, userId, 120, "2026-05-04");
    await accounts.setPrice(a.id, userId, 130, "2026-05-04");
    assert.deepEqual(await prices.listByAccount(a.id), [
      { date: "2026-05-02", price: 100 },
      { date: "2026-05-04", price: 130 },
    ]);
    const r = (await accounts.findByIdForUser(a.id, userId))!;
    assert.equal(r.currentPrice, 130);
    assert.ok(r.priceUpdatedAt);
  });

  test("P2 a back-dated price is recorded but does not replace the newer current price", async () => {
    const prices = new InvestmentPriceRepository(pool);
    const a = await newAccount();
    await accounts.setPrice(a.id, userId, 200, "2026-05-10");
    const before = (await accounts.findByIdForUser(a.id, userId))!;
    await accounts.setPrice(a.id, userId, 150, "2026-05-01");
    const after = (await accounts.findByIdForUser(a.id, userId))!;
    assert.equal(after.currentPrice, 200);
    assert.equal(after.priceUpdatedAt, before.priceUpdatedAt);
    assert.deepEqual((await prices.listByAccount(a.id)).map((p) => p.date), ["2026-05-01", "2026-05-10"]);
  });

  test("P3 re-entering an older date overwrites only that day and leaves the current price", async () => {
    const prices = new InvestmentPriceRepository(pool);
    const a = await newAccount();
    await accounts.setPrice(a.id, userId, 100, "2026-05-01");
    await accounts.setPrice(a.id, userId, 200, "2026-05-02");
    await accounts.setPrice(a.id, userId, 111, "2026-05-01");
    assert.deepEqual(await prices.listByAccount(a.id), [
      { date: "2026-05-01", price: 111 },
      { date: "2026-05-02", price: 200 },
    ]);
    assert.equal((await accounts.findByIdForUser(a.id, userId))!.currentPrice, 200);
  });

  test("P4 another user's price entry is rejected and writes nothing", async () => {
    const prices = new InvestmentPriceRepository(pool);
    const a = await newAccount();
    assert.equal(await accounts.setPrice(a.id, otherUserId, 100, "2026-05-01"), null);
    assert.deepEqual(await prices.listByAccount(a.id), []);
  });
  describe("listByUser sorting", () => {
    let sortUser: number;
    const names = (rows: { name: string }[]) => rows.map((r) => r.name);

    before(async () => {
      // A private user, so accounts from the other tests do not leak into the ordering.
      sortUser = (await pool.query<{ id: number }>(
        "INSERT INTO users (email, first_name, last_name, password_hash) VALUES ('sort@test.io', 'S', 'U', 'x') RETURNING id",
      )).rows[0]!.id;
      const mk = async (name: string, qty: number, cost: number, price: number | null) => {
        const a = await newAccount(name, sortUser);
        await svc.execute(sortUser, a.id, trade("buy", "2026-05-01", qty, cost / qty));
        if (price !== null) await accounts.setPrice(a.id, sortUser, price, "2026-05-02");
      };
      // value: Bravo 500, alpha 2000, Charlie 1000. gain: Bravo +100, alpha -500, Charlie -200.
      await mk("Bravo", 10, 400, 50);
      await mk("alpha", 10, 2500, 200);
      await mk("Charlie", 10, 1200, 100);
      await mk("Delta (unpriced)", 10, 100, null);
      await mk("Echo (unpriced)", 10, 100, null);
    });

    test("S1 no sort keeps newest first", async () => {
      const rows = await accounts.listByUser(sortUser);
      assert.deepEqual(names(rows), ["Echo (unpriced)", "Delta (unpriced)", "Charlie", "alpha", "Bravo"]);
    });

    test("S2 name sorts case-insensitively in both directions", async () => {
      assert.deepEqual(names(await accounts.listByUser(sortUser, { sortBy: "name", order: "asc" })),
        ["alpha", "Bravo", "Charlie", "Delta (unpriced)", "Echo (unpriced)"]);
      assert.deepEqual(names(await accounts.listByUser(sortUser, { sortBy: "name", order: "desc" })),
        ["Echo (unpriced)", "Delta (unpriced)", "Charlie", "Bravo", "alpha"]);
    });

    test("S3 value sorts both ways, unpriced last in both, ties by name", async () => {
      assert.deepEqual(names(await accounts.listByUser(sortUser, { sortBy: "value", order: "asc" })),
        ["Bravo", "Charlie", "alpha", "Delta (unpriced)", "Echo (unpriced)"]);
      assert.deepEqual(names(await accounts.listByUser(sortUser, { sortBy: "value", order: "desc" })),
        ["alpha", "Charlie", "Bravo", "Delta (unpriced)", "Echo (unpriced)"]);
    });

    test("S4 gain sorts by the Rupiah amount both ways, unpriced last in both", async () => {
      assert.deepEqual(names(await accounts.listByUser(sortUser, { sortBy: "gain", order: "asc" })),
        ["alpha", "Charlie", "Bravo", "Delta (unpriced)", "Echo (unpriced)"]);
      assert.deepEqual(names(await accounts.listByUser(sortUser, { sortBy: "gain", order: "desc" })),
        ["Bravo", "Charlie", "alpha", "Delta (unpriced)", "Echo (unpriced)"]);
    });

    test("S5 sortBy without order is ascending, and order without sortBy is ignored", async () => {
      assert.deepEqual(names(await accounts.listByUser(sortUser, { sortBy: "name" })).slice(0, 2), ["alpha", "Bravo"]);
      assert.deepEqual(names(await accounts.listByUser(sortUser, { order: "desc" })),
        names(await accounts.listByUser(sortUser)));
    });

    test("S6 sorting is owner scoped", async () => {
      const rows = await accounts.listByUser(otherUserId, { sortBy: "name", order: "asc" });
      assert.ok(rows.every((r) => !["Bravo", "alpha", "Charlie"].includes(r.name)));
    });
  });
});
