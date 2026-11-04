import assert from "node:assert/strict";
import { test } from "node:test";
import { hasAtMostDecimals, round6, roundTo } from "./decimal.js";

test("round6 removes binary float noise", () => {
  assert.equal(round6(0.1 + 0.2), 0.3);
  assert.equal(round6(3086419.7249999996), 3086419.725);
  assert.equal(round6(0.30000000000000004), 0.3);
});

test("round6 never returns -0 and keeps sign", () => {
  assert.ok(Object.is(round6(-0.0000001), 0));
  assert.equal(round6(-1.5), -1.5);
  assert.equal(round6(-100.6666666667), -100.666667);
});

test("round6 keeps large integers and decimals intact", () => {
  for (const n of [999_999_999_999_999, 123_456_789_012_345, 9e14, 123_456_789_012.345678]) {
    assert.equal(round6(n), n);
    assert.equal(round6(round6(n)), round6(n));
  }
});

test("roundTo rounds to the requested places", () => {
  assert.equal(roundTo(100.6666666667, 6), 100.666667);
  // Uses the exact binary value: 1.005 is really 1.00499999999999989…, so it rounds down.
  assert.equal(roundTo(1.005, 2), 1);
  assert.equal(roundTo(2.5, 0), 3);
});

test("hasAtMostDecimals", () => {
  assert.ok(hasAtMostDecimals(0.123456, 6));
  assert.ok(hasAtMostDecimals(2.5, 6));
  assert.ok(hasAtMostDecimals(1234567.89, 2));
  assert.ok(hasAtMostDecimals(0.1 + 0.2, 6));
  assert.ok(!hasAtMostDecimals(0.9999996, 6));
  assert.ok(!hasAtMostDecimals(0.1234567, 6));
  assert.ok(!hasAtMostDecimals(1e-7, 6));
  assert.ok(!hasAtMostDecimals(5500.005, 2));
});
