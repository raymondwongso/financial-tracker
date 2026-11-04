import { describe, expect, it } from "vitest";
import { occurredAtForDate, rangeForPreset, rangeLabel } from "./date-range";

const today = new Date(2026, 9, 26); // 26 Oct 2026

describe("rangeForPreset", () => {
  it("computes presets in local time", () => {
    expect(rangeForPreset("mtd", today)).toEqual({ preset: "mtd", from: "2026-10-01", to: "2026-10-26" });
    expect(rangeForPreset("ytd", today)).toEqual({ preset: "ytd", from: "2026-01-01", to: "2026-10-26" });
    expect(rangeForPreset("1m", today).from).toBe("2026-09-26");
    expect(rangeForPreset("3m", today).from).toBe("2026-07-26");
    expect(rangeForPreset("6m", today).from).toBe("2026-04-26");
    expect(rangeForPreset("all", today)).toEqual({ preset: "all", from: "", to: "" });
  });

  it("clamps the day when the target month is shorter", () => {
    expect(rangeForPreset("1m", new Date(2026, 2, 31)).from).toBe("2026-02-28");
  });
});

describe("rangeLabel", () => {
  it("labels bounded and unbounded ranges", () => {
    const fmt = (iso: string) => iso.slice(0, 10);
    expect(rangeLabel(rangeForPreset("mtd", today), fmt)).toBe("2026-10-01 – 2026-10-26");
    expect(rangeLabel(rangeForPreset("all", today), fmt)).toBe("All time");
  });
});

describe("occurredAtForDate", () => {
  it("omits today and later so the server uses the real time", () => {
    expect(occurredAtForDate("2026-10-26", today)).toBeUndefined();
    expect(occurredAtForDate("2026-10-27", today)).toBeUndefined();
  });

  it("maps a past day to local noon of that day", () => {
    const iso = occurredAtForDate("2026-10-20", today);
    expect(iso).toBe(new Date(2026, 9, 20, 12).toISOString());
  });
});
