import assert from "node:assert/strict";
import { test } from "node:test";
import { loadConfig } from "./config.js";

test("production refuses a missing or short JWT_SECRET", () => {
  assert.throws(() => loadConfig({ NODE_ENV: "production" }), /JWT_SECRET/);
  assert.throws(() => loadConfig({ NODE_ENV: "production", JWT_SECRET: "short" }), /JWT_SECRET/);
});

test("production accepts a long JWT_SECRET and defaults cookies to secure", () => {
  const config = loadConfig({ NODE_ENV: "production", JWT_SECRET: "x".repeat(32) });
  assert.equal(config.jwtSecret, "x".repeat(32));
  assert.equal(config.cookieSecure, true);
});

test("COOKIE_SECURE can be overridden explicitly", () => {
  const config = loadConfig({ NODE_ENV: "production", JWT_SECRET: "x".repeat(32), COOKIE_SECURE: "false" });
  assert.equal(config.cookieSecure, false);
});

test("development keeps the dev defaults", () => {
  const config = loadConfig({});
  assert.equal(config.cookieSecure, false);
  assert.ok(config.jwtSecret.length > 0);
});

test("TRUST_PROXY is off by default and enabled only by the exact value \"true\"", () => {
  assert.equal(loadConfig({}).trustProxy, false);
  assert.equal(loadConfig({ TRUST_PROXY: "1" }).trustProxy, false);
  assert.equal(loadConfig({ TRUST_PROXY: "true" }).trustProxy, true);
});
