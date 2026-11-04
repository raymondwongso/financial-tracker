import assert from "node:assert/strict";
import { test } from "node:test";
import { hashPassword, verifyPassword } from "./password.js";

test("hashPassword produces salted hashes that verify", async () => {
  const a = await hashPassword("secret123");
  const b = await hashPassword("secret123");
  assert.notEqual(a, b);
  assert.equal(await verifyPassword("secret123", a), true);
  assert.equal(await verifyPassword("wrong", a), false);
});

test("verifyPassword rejects malformed stored values", async () => {
  assert.equal(await verifyPassword("x", "garbage"), false);
});
