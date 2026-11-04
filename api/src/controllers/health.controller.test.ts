import assert from "node:assert/strict";
import { test } from "node:test";
import { buildApp } from "../app.js";
import { loadConfig } from "../config.js";

test("GET /api/health returns ok and version", async () => {
  const app = buildApp({ ...loadConfig(), logLevel: "silent" });
  try {
    const res = await app.inject({ method: "GET", url: "/api/health" });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.json(), { status: "ok", version: "1.0.0" });
  } finally {
    await app.close();
  }
});
