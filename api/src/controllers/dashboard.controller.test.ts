import assert from "node:assert/strict";
import { test } from "node:test";
import { buildApp } from "../app.js";
import { loadConfig } from "../config.js";

test("GET /api/dashboard/total-assets requires authentication", async () => {
  const app = buildApp({ ...loadConfig(), logLevel: "silent" });
  try {
    const res = await app.inject({ method: "GET", url: "/api/dashboard/total-assets" });
    assert.equal(res.statusCode, 401);
  } finally {
    await app.close();
  }
});
