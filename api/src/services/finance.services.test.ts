import assert from "node:assert/strict";
import { test } from "node:test";
import type { AccountWithBalance, Category, Transaction } from "@financialtracker/shared";
import { AppError } from "../errors.js";
import { CreateAccountService } from "./create-account.service.js";
import { CreateTransactionService } from "./create-transaction.service.js";
import { DeleteAccountService } from "./delete-account.service.js";
import { DeleteTransactionService } from "./delete-transaction.service.js";
import { GetAccountService } from "./get-account.service.js";
import { GetOrCreateCategoryService } from "./get-or-create-category.service.js";
import { ListTransactionsService } from "./list-transactions.service.js";

async function rejects(p: Promise<unknown>, status: number) {
  await assert.rejects(p, (e: unknown) => e instanceof AppError && e.statusCode === status);
}

const account = (id: number): AccountWithBalance => ({
  id, name: "BCA", description: "", initialBalance: 0, createdAt: "2026-01-01T00:00:00.000Z",
  balance: 0, lastTransactionAt: null,
});

test("create account validates and maps duplicate names to 409", async () => {
  const ok = new CreateAccountService({
    create: async (a) => ({ id: 1, name: a.name, description: a.description, initialBalance: a.initialBalance, createdAt: "x" }),
  });
  assert.equal((await ok.execute(1, { name: "  BCA ", initialBalance: 5 })).name, "BCA");
  await rejects(ok.execute(1, { name: " ", initialBalance: 0 }), 400);
  await rejects(ok.execute(1, { name: "x", initialBalance: -1 }), 400);
  const dup = new CreateAccountService({
    create: async () => {
      throw Object.assign(new Error("dup"), { code: "23505" });
    },
  });
  await rejects(dup.execute(1, { name: "BCA", initialBalance: 0 }), 409);
});

test("get account is scoped to the owner (404 for others)", async () => {
  const svc = new GetAccountService({ findByIdForUser: async (id, uid) => (uid === 1 ? account(id) : null) });
  assert.equal((await svc.execute(1, 5)).id, 5);
  await rejects(svc.execute(2, 5), 404);
});

test("category get-or-create reuses an existing name case-insensitively", async () => {
  const store: Category[] = [{ id: 1, name: "Food" }];
  let created = 0;
  const svc = new GetOrCreateCategoryService({
    findByName: async (_u, n) => store.find((c) => c.name.toLowerCase() === n.toLowerCase()) ?? null,
    create: async (_u, n) => {
      created++;
      return { id: 2, name: n };
    },
  });
  assert.equal((await svc.execute(1, " food ")).id, 1);
  assert.equal((await svc.execute(1, "Travel")).id, 2);
  assert.equal(created, 1);
  await rejects(svc.execute(1, "  "), 400);
});

function txService(owned = true) {
  const created: unknown[] = [];
  const svc = new CreateTransactionService(
    { findByIdForUser: async (id) => (owned ? account(id) : null) },
    { findByIdForUser: async (id) => ({ id, name: "Food" }) },
    {
      create: async (t) => {
        created.push(t);
        return { id: 1, ...t, categoryName: "Food", createdAt: "x" } as Transaction;
      },
    },
  );
  return { svc, created };
}

test("create transaction validates amount/description and trims", async () => {
  const { svc, created } = txService();
  const base = { accountId: 1, categoryId: 1, type: "expense" as const, amount: 100 };
  await svc.execute(1, { ...base, description: "  lunch " });
  assert.equal((created[0] as { description: string }).description, "lunch");
  await rejects(svc.execute(1, { ...base, amount: 0 }), 400);
  await rejects(svc.execute(1, { ...base, amount: 1.5 }), 400);
  await rejects(svc.execute(1, { ...base, description: "x".repeat(121) }), 400);
});

test("create transaction backdates with occurredAt and defaults to now", async () => {
  const { svc, created } = txService();
  const base = { accountId: 1, categoryId: 1, type: "expense" as const, amount: 100 };
  await svc.execute(1, base);
  assert.equal((created[0] as { createdAt: Date | null }).createdAt, null);
  await svc.execute(1, { ...base, occurredAt: "2026-10-01T05:00:00.000Z" });
  assert.equal(
    (created[1] as { createdAt: Date }).createdAt.toISOString(),
    "2026-10-01T05:00:00.000Z",
  );
});

test("create transaction rejects invalid or future occurredAt", async () => {
  const { svc, created } = txService();
  const base = { accountId: 1, categoryId: 1, type: "expense" as const, amount: 100 };
  await rejects(svc.execute(1, { ...base, occurredAt: "not-a-date" }), 400);
  const future = new Date(Date.now() + 86_400_000).toISOString();
  await rejects(svc.execute(1, { ...base, occurredAt: future }), 400);
  assert.equal(created.length, 0);
});

test("create transaction rejects someone else's account", async () => {
  await rejects(
    txService(false).svc.execute(1, { accountId: 1, categoryId: 1, type: "income", amount: 5 }),
    404,
  );
});

test("list transactions pages with an opaque cursor and total", async () => {
  const all: Transaction[] = [3, 2, 1].map((id) => ({
    id, accountId: 1, categoryId: 1, categoryName: "Food", type: "expense", amount: 10,
    description: null, createdAt: `2026-01-0${id}T00:00:00.000Z`,
  }));
  const svc = new ListTransactionsService(
    { findByIdForUser: async (id, uid) => (uid === 1 ? account(id) : null) },
    { list: async (q) => all.slice(0, q.limit + 1), count: async () => 3 },
  );
  const page = await svc.execute({ userId: 1, accountId: 1, from: null, to: null, limit: 2, cursor: null });
  assert.deepEqual(page.items.map((t) => t.id), [3, 2]);
  assert.ok(page.nextCursor);
  assert.equal(page.total, 3);
  const last = await svc.execute({ userId: 1, accountId: 1, from: null, to: null, limit: 5, cursor: null });
  assert.equal(last.nextCursor, null);
  await rejects(svc.execute({ userId: 1, accountId: 1, from: null, to: null, limit: 2, cursor: "bad" }), 400);
  await rejects(svc.execute({ userId: 2, accountId: 1, from: null, to: null, limit: 2, cursor: null }), 404);
});

test("delete transaction is scoped to the owner and 404s when nothing matched", async () => {
  const calls: [number, number][] = [];
  const svc = new DeleteTransactionService({
    delete: async (id, uid) => {
      calls.push([id, uid]);
      return uid === 1;
    },
  });
  await svc.execute(1, 7);
  assert.deepEqual(calls, [[7, 1]]);
  await rejects(svc.execute(2, 7), 404);
});

test("delete account is scoped to the owner and 404s when nothing matched", async () => {
  const calls: [number, number][] = [];
  const svc = new DeleteAccountService({
    delete: async (id, uid) => {
      calls.push([id, uid]);
      return uid === 1;
    },
  });
  await svc.execute(1, 7);
  assert.deepEqual(calls, [[7, 1]]);
  await rejects(svc.execute(2, 7), 404);
});
