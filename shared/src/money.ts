/** Number of minor-unit digits for a currency (USD → 2, JPY → 0), per Intl / ISO 4217. */
export function fractionDigits(currency: string): number {
  return (
    new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions()
      .maximumFractionDigits ?? 2
  );
}

/** Converts a major-unit amount (e.g. `12.5` dollars) to integer minor units (`1250` cents). */
export function toMinor(amount: number, currency: string): number {
  const factor = 10 ** fractionDigits(currency);
  return Math.round(amount * factor);
}

/** Converts integer minor units back to a major-unit number. */
export function toMajor(amountMinor: number, currency: string): number {
  return amountMinor / 10 ** fractionDigits(currency);
}

/**
 * Formats minor units for display with the local currency symbol,
 * e.g. `formatMoney(123456, 'USD')` → `$1,234.56`, `formatMoney(1500000, 'IDR')` → `Rp 1,500,000`.
 * `signed` adds an explicit `+` for positive amounts (used for income).
 */
export function formatMoney(
  amountMinor: number,
  currency: string,
  { locale = 'en-US', signed = false }: { locale?: string; signed?: boolean } = {},
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    signDisplay: signed ? 'exceptZero' : 'auto',
  }).format(toMajor(amountMinor, currency));
}

/** Returns `[firstDay, firstDayOfNextMonth)` as `YYYY-MM-DD` strings for a `YYYY-MM` month. */
export function monthRange(month: string): { start: string; end: string } {
  const [year, mon] = month.split('-').map(Number) as [number, number];
  const next = mon === 12 ? `${year + 1}-01` : `${year}-${String(mon + 1).padStart(2, '0')}`;
  return { start: `${month}-01`, end: `${next}-01` };
}

/** Inclusive `YYYY-MM-DD` bounds of a `YYYY-MM` month, e.g. `2026-02` → 2026-02-01 … 2026-02-28. */
export function monthBounds(month: string): { from: string; to: string } {
  const [year, mon] = month.split('-').map(Number) as [number, number];
  const lastDay = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(lastDay).padStart(2, '0')}` };
}

/** Current month as `YYYY-MM` in UTC. */
export function currentMonth(now = new Date()): string {
  return now.toISOString().slice(0, 7);
}
