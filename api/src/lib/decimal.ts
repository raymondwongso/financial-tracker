/**
 * Rounds to `places` decimals using the exact decimal expansion of the double
 * (toFixed), so large values keep their integer part and 0.1+0.2 → 0.3.
 * Never returns -0.
 */
export function roundTo(n: number, places: number): number {
  return Number(n.toFixed(places)) + 0;
}

export const round6 = (n: number): number => roundTo(n, 6);

/** True when `n` has no more than `places` decimals (tolerant of binary float noise). */
export function hasAtMostDecimals(n: number, places: number): boolean {
  const scaled = n * 10 ** places;
  return Math.abs(scaled - Math.round(scaled)) < 1e-6;
}
