import assert from "node:assert/strict";
import { test } from "node:test";
import { decodeCursor, encodeCursor } from "./cursor.js";

test("cursor round-trips", () => {
  const c = { createdAt: "2026-10-26T10:00:00.000Z", id: 42 };
  assert.deepEqual(decodeCursor(encodeCursor(c)), c);
});

test("decodeCursor rejects junk", () => {
  assert.equal(decodeCursor("not-a-cursor"), null);
  assert.equal(decodeCursor(Buffer.from('{"createdAt":"x","id":1}').toString("base64url")), null);
  assert.equal(decodeCursor(Buffer.from('{"createdAt":"2026-01-01T00:00:00Z","id":"1"}').toString("base64url")), null);
});
