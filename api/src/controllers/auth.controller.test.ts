import assert from "node:assert/strict";
import { test } from "node:test";
import { buildApp } from "../app.js";
import { loadConfig } from "../config.js";


test("protected routes return 401 without a token", async () => {
  const app = buildApp({ ...loadConfig(), logLevel: "silent" });
  try {
    for (const url of ["/api/auth/me", "/api/accounts", "/api/categories", "/api/dashboard/summary"]) {
      const res = await app.inject({ method: "GET", url });
      assert.equal(res.statusCode, 401, url);
      assert.deepEqual(res.json(), { error: "Unauthorized" });
    }
    const post = await app.inject({ method: "POST", url: "/api/transactions", payload: {} });
    assert.equal(post.statusCode, 401);
  } finally {
    await app.close();
  }
});

test("register validates the body shape (400, { error })", async () => {
  const app = buildApp({ ...loadConfig(), logLevel: "silent" });
  try {
    const res = await app.inject({ method: "POST", url: "/api/auth/register", payload: { email: "a@b.co" } });
    assert.equal(res.statusCode, 400);
    assert.equal(typeof res.json().error, "string");
  } finally {
    await app.close();
  }
});

test("garbage token is rejected", async () => {
  const app = buildApp({ ...loadConfig(), logLevel: "silent" });
  try {
    const res = await app.inject({ method: "GET", url: "/api/accounts", headers: { cookie: "token=abc" } });
    assert.equal(res.statusCode, 401);
  } finally {
    await app.close();
  }
});

test("logout clears the cookie", async () => {
  const app = buildApp({ ...loadConfig(), logLevel: "silent" });
  try {
    const res = await app.inject({ method: "POST", url: "/api/auth/logout" });
    assert.equal(res.statusCode, 204);
    assert.match(String(res.headers["set-cookie"]), /token=;/);
  } finally {
    await app.close();
  }
});


test("login is rate limited per client", async () => {
  const app = buildApp({ ...loadConfig(), logLevel: "silent" });
  try {
    // Invalid body => 400 without touching the database, but each call still counts toward the limit.
    const statuses: number[] = [];
    for (let i = 0; i < 12; i++) {
      const res = await app.inject({ method: "POST", url: "/api/auth/login", payload: {} });
      statuses.push(res.statusCode);
    }
    assert.equal(statuses[0], 400);
    assert.equal(statuses[11], 429);
  } finally {
    await app.close();
  }
});

test("the scaffold dummies route is no longer exposed", async () => {
  const app = buildApp({ ...loadConfig(), logLevel: "silent" });
  try {
    const res = await app.inject({ method: "GET", url: "/api/dummies" });
    assert.equal(res.statusCode, 404);
  } finally {
    await app.close();
  }
});

test("responses carry security headers", async () => {
  const app = buildApp({ ...loadConfig(), logLevel: "silent" });
  try {
    const res = await app.inject({ method: "GET", url: "/api/health" });
    assert.equal(res.headers["x-content-type-options"], "nosniff");
  } finally {
    await app.close();
  }
});
