/**
 * Minor-unit digits for currencies that don't use 2 (ISO 4217, plus IDR = 0 because the rupiah has
 * no subunit in practice). This is a fixed table on purpose: Intl's currency data depends on the
 * runtime's ICU version, so a browser and the server could disagree (e.g. IDR 0 vs 2) and store or
 * display amounts 100x off.
 */
const MINOR_UNITS: Record<string, number> = {
  BHD: 3,
  BIF: 0,
  CLP: 0,
  DJF: 0,
  GNF: 0,
  IDR: 0,
  IQD: 3,
  ISK: 0,
  JOD: 3,
  JPY: 0,
  KMF: 0,
  KRW: 0,
  KWD: 3,
  LYD: 3,
  OMR: 3,
  PYG: 0,
  RWF: 0,
  TND: 3,
  UGX: 0,
  UYI: 0,
  VND: 0,
  VUV: 0,
  XAF: 0,
  XOF: 0,
  XPF: 0,
};

/** Number of minor-unit digits for a currency (USD → 2, IDR/JPY → 0, KWD → 3). */
export function fractionDigits(currency: string): number {
  return MINOR_UNITS[currency.toUpperCase()] ?? 2;
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
    // Pin the digits to our table so every runtime renders the same amount.
    minimumFractionDigits: fractionDigits(currency),
    maximumFractionDigits: fractionDigits(currency),
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
