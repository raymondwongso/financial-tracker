import { describe, expect, it } from "vitest";
import { formatTicks, priceScale } from "./price-scale";

describe("priceScale", () => {
  it("spans the data with headroom and does not start at zero for high prices", () => {
    const s = priceScale([9800, 10200]);
    expect(s.min).toBeGreaterThan(0);
    expect(s.min).toBeLessThanOrEqual(9800);
    expect(s.max).toBeGreaterThanOrEqual(10200);
    expect(s.ticks[0]).toBe(s.min);
    expect(s.ticks.at(-1)).toBe(s.max);
  });

  it("gives a flat series a range around its value", () => {
    const s = priceScale([5000, 5000]);
    expect(s.min).toBeLessThan(5000);
    expect(s.max).toBeGreaterThan(5000);
  });

  it("never goes below zero", () => {
    expect(priceScale([1, 3]).min).toBe(0);
  });

  it("handles a single value", () => {
    const s = priceScale([6500]);
    expect(s.min).toBeLessThan(6500);
    expect(s.max).toBeGreaterThan(6500);
  });
});

describe("formatTicks", () => {
  it("uses full numbers when abbreviating would round a tick (5150 must not read 5,2 K)", () => {
    expect(formatTicks([5000, 5050, 5100, 5150, 5200])).toEqual(["5.000", "5.050", "5.100", "5.150", "5.200"]);
  });

  it("stays compact when every tick is exact", () => {
    expect(formatTicks([5000, 5200, 5400])).toEqual(["5 K", "5,2 K", "5,4 K"]);
    expect(formatTicks([1_000_000, 1_500_000])).toEqual(["1 Mio", "1,5 Mio"]);
  });

  it("goes full for million-range prices with fine steps", () => {
    expect(formatTicks([1_500_000, 1_550_000, 1_600_000])).toEqual(["1.500.000", "1.550.000", "1.600.000"]);
  });
});
