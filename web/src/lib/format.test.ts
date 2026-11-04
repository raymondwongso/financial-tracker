import { describe, expect, it } from "vitest";
import { formatAbbrev, formatDate, formatDateShort, formatDecimalInput, formatDigits, formatGain, formatIdr, formatPrice, formatQuantity, parseDecimalInput, sanitizeDecimal, sanitizeDigits } from "./format";

describe("formatIdr", () => {
  it("uses id-ID separators and a proper minus", () => {
    expect(formatIdr(1250000)).toBe("Rp 1.250.000");
    expect(formatIdr(-50000)).toBe("−Rp 50.000");
    expect(formatIdr(0)).toBe("Rp 0");
  });
});

describe("amount input helpers", () => {
  it("keeps digits only, drops leading zeros, caps at 15 digits", () => {
    expect(sanitizeDigits("00a1,0b00")).toBe("1000");
    expect(sanitizeDigits("1".repeat(20))).toHaveLength(15);
    expect(formatDigits("1000")).toBe("1.000");
    expect(formatDigits("")).toBe("");
  });
});

describe("formatAbbrev", () => {
  it("abbreviates with K/Mio/Bio/Tio and a decimal comma", () => {
    expect(formatAbbrev(950)).toBe("950");
    expect(formatAbbrev(500_000)).toBe("500 K");
    expect(formatAbbrev(3_300_000)).toBe("3,3 Mio");
    expect(formatAbbrev(20_000_000)).toBe("20 Mio");
    expect(formatAbbrev(2_500_000_000)).toBe("2,5 Bio");
    expect(formatAbbrev(4_000_000_000_000)).toBe("4 Tio");
  });
});

describe("dates", () => {
  it("formats long and short", () => {
    expect(formatDate("2026-10-26T12:00:00")).toBe("26 Oct 2026");
    expect(formatDateShort("2026-10-26T12:00:00")).toBe("26/10/26");
  });
});

describe("investment formatters", () => {
  it("formats quantities with up to 6 decimals", () => {
    expect(formatQuantity(2.5)).toBe("2,5");
    expect(formatQuantity(1200)).toBe("1.200");
    expect(formatQuantity(0.000001)).toBe("0,000001");
  });
  it("formats unit prices keeping decimals", () => {
    expect(formatPrice(5500)).toBe("Rp 5.500");
    expect(formatPrice(5500.5)).toBe("Rp 5.500,5");
  });
  it("signs gains", () => {
    expect(formatGain(200000)).toBe("+Rp 200.000");
    expect(formatGain(-50000)).toBe("−Rp 50.000");
    expect(formatGain(0)).toBe("Rp 0");
  });
  it("sanitizes decimal input", () => {
    expect(sanitizeDecimal("12,5", 6)).toBe("12.5");
    expect(sanitizeDecimal("1.2.3", 6)).toBe("1.23");
    expect(sanitizeDecimal("abc", 6)).toBe("");
    expect(sanitizeDecimal("007", 6)).toBe("7");
    expect(sanitizeDecimal(".5", 6)).toBe("0.5");
    expect(sanitizeDecimal("1.23456789", 6)).toBe("1.234567");
    expect(sanitizeDecimal("1.239", 2)).toBe("1.23");
  });
});

describe("formatDecimalInput", () => {
  it("groups the integer part and uses a comma for decimals", () => {
    expect(formatDecimalInput("")).toBe("");
    expect(formatDecimalInput("7")).toBe("7");
    expect(formatDecimalInput("1250000")).toBe("1.250.000");
    expect(formatDecimalInput("1250000.5")).toBe("1.250.000,5");
  });

  it("keeps partial input while typing", () => {
    expect(formatDecimalInput("12.")).toBe("12,");
    expect(formatDecimalInput("0.50")).toBe("0,50");
    expect(formatDecimalInput("1000.000")).toBe("1.000,000");
  });
});

describe("parseDecimalInput", () => {
  it("drops thousand separators and reads a comma as the decimal point", () => {
    expect(parseDecimalInput("1.250.000", 6)).toBe("1250000");
    expect(parseDecimalInput("1.250.000,5", 6)).toBe("1250000.5");
    expect(parseDecimalInput("12,", 6)).toBe("12.");
  });

  it("limits decimals and ignores junk", () => {
    expect(parseDecimalInput("1,23456789", 6)).toBe("1.234567");
    expect(parseDecimalInput("1,239", 2)).toBe("1.23");
    expect(parseDecimalInput("abc", 6)).toBe("");
  });
});
