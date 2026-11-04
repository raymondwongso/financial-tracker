import { describe, expect, it } from "vitest";
import { niceScale } from "./nice-scale";

describe("niceScale", () => {
  it("falls back to 0..1 Mio for empty data", () => {
    expect(niceScale(0)).toEqual({ max: 1_000_000, step: 250_000 });
  });
  it("snaps to nice steps (18,5 Mio → 5 Mio steps, axis 20 Mio)", () => {
    expect(niceScale(18_500_000)).toEqual({ max: 20_000_000, step: 5_000_000 });
  });
  it("supports 2,5 steps", () => {
    expect(niceScale(10_000_000)).toEqual({ max: 10_000_000, step: 2_500_000 });
  });
  it("always covers the max value with at most 5 intervals", () => {
    for (const v of [1, 7, 999, 123_456, 7_654_321, 98_765_432_100]) {
      const { max, step } = niceScale(v);
      expect(max).toBeGreaterThanOrEqual(v);
      expect(max / step).toBeGreaterThanOrEqual(2);
      expect(max / step).toBeLessThanOrEqual(5);
    }
  });
});
