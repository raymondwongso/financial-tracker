import { formatAbbrev } from "@/lib/format";

export interface PriceScale {
  min: number;
  max: number;
  ticks: number[];
}

/** Rounds a rough step up to 1, 2, 2.5, 5 or 10 × 10^n. */
function niceStep(rough: number): number {
  const p = 10 ** Math.floor(Math.log10(rough));
  const f = rough / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
}

/**
 * Y axis for a price line. Unlike a bar chart it does not start at zero (that would flatten the
 * line): it spans the data with a little headroom, snapped to "nice" tick steps.
 */
export function priceScale(values: number[]): PriceScale {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  // A flat series still needs a range to draw in.
  const span = hi - lo || Math.max(Math.abs(hi) * 0.1, 1);
  const step = niceStep(span / 3);
  const min = Math.max(0, Math.floor((lo - span * 0.1) / step) * step);
  const max = Math.ceil((hi + span * 0.1) / step) * step;
  const ticks: number[] = [];
  for (let t = min; t <= max + step / 2; t += step) ticks.push(Number(t.toFixed(6)));
  return { min, max, ticks };
}

const SIZES = [1e12, 1e9, 1e6, 1e3];
const full = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 });

/** True when `formatAbbrev` (one decimal) shows `t` exactly, e.g. 5.200 → "5,2 K" but 5.150 → "5,2 K" is not. */
function abbrevIsExact(t: number): boolean {
  const size = SIZES.find((x) => Math.abs(t) >= x);
  return size === undefined || Math.abs(Math.round((t / size) * 10) / 10 * size - t) < 1e-6;
}

/**
 * Y-axis labels. Compact ("5,2 K", "1,5 Mio") when every tick is exact in that form, otherwise the
 * full number ("5.150"), so a rounded label never contradicts the gridline it sits on.
 */
export function formatTicks(ticks: number[]): string[] {
  return ticks.every(abbrevIsExact) ? ticks.map(formatAbbrev) : ticks.map((t) => full.format(t));
}
