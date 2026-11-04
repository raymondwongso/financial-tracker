import assert from "node:assert/strict";
import { test } from "node:test";
import jwt from "@fastify/jwt";
import Fastify from "fastify";
import type { InvestmentAccountList, InvestmentListQuery } from "@financialtracker/shared";
import { investmentAccountsController } from "./investment-accounts.controller.js";

const unused = {
  execute: async (): Promise<never> => {
    throw new Error("unused in this test");
  },
};
const emptyList: InvestmentAccountList = { items: [], summary: { totalCost: 0, totalValue: 0, unrealizedGain: 0 } };

async function setup() {
  const calls: Array<{ userId: number; query: InvestmentListQuery | undefined }> = [];
  const app = Fastify();
  await app.register(jwt, { secret: "test-secret" });
  await app.register(
    investmentAccountsController({
      listAccounts: {
        execute: async (userId, query) => {
          // Fastify hands over a null-prototype object; copy it so deepEqual compares plain values.
          calls.push({ userId, query: query && { ...query } });
          return emptyList;
        },
      },
      getAccount: unused,
      createAccount: unused,
      setPrice: unused,
      listPriceHistory: unused,
      listTransactions: unused,
      createTransaction: unused,
      deleteAccount: unused,
      deleteTransaction: unused,
    }),
    { prefix: "/api" },
  );
  const headers = { authorization: `Bearer ${app.jwt.sign({ id: 7 })}` };
  return { app, calls, headers };
}

test("GET /investment-accounts forwards sortBy and order to the service", async () => {
  const { app, calls, headers } = await setup();
  try {
    const res = await app.inject({ method: "GET", url: "/api/investment-accounts?sortBy=gain&order=desc", headers });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(calls, [{ userId: 7, query: { sortBy: "gain", order: "desc" } }]);
  } finally {
    await app.close();
  }
});

test("GET /investment-accounts without sort params passes an empty query", async () => {
  const { app, calls, headers } = await setup();
  try {
    const res = await app.inject({ method: "GET", url: "/api/investment-accounts", headers });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(calls, [{ userId: 7, query: {} }]);
  } finally {
    await app.close();
  }
});

test("GET /investment-accounts rejects an unknown sortBy or order with 400", async () => {
  const { app, calls, headers } = await setup();
  try {
    for (const qs of ["sortBy=quantity", "sortBy=name&order=sideways", "order=up"]) {
      const res = await app.inject({ method: "GET", url: `/api/investment-accounts?${qs}`, headers });
      assert.equal(res.statusCode, 400, qs);
    }
    assert.equal(calls.length, 0);
  } finally {
    await app.close();
  }
});

test("GET /investment-accounts requires authentication even with valid sort params", async () => {
  const { app } = await setup();
  try {
    const res = await app.inject({ method: "GET", url: "/api/investment-accounts?sortBy=name" });
    assert.equal(res.statusCode, 401);
  } finally {
    await app.close();
  }
});
