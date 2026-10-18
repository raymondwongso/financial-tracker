import { formatMoney, type TransactionType } from '@ft/shared';

const MINUS = '−';

/** Money with the local currency symbol and a typographic minus, e.g. `−Rp 1,500,000`. */
export function money(amountMinor: number, currency: string, { signed = false } = {}): string {
  return formatMoney(amountMinor, currency, { signed }).replace('-', MINUS);
}

/** Transaction amount with its direction: `+$250.00` for income, `−$12.50` for expenses. */
export function txAmount(amountMinor: number, currency: string, type: TransactionType): string {
  return money(type === 'income' ? amountMinor : -amountMinor, currency, { signed: true });
}

const dateFmt = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});
const shortDateFmt = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: '2-digit',
  timeZone: 'UTC',
});
const dayMonthFmt = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});
const monthFmt = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
const dateTimeFmt = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const utc = (date: string) => new Date(`${date}T00:00:00Z`);

/** `2026-10-18` → `18 Oct 2026` */
export const formatDate = (date: string) => dateFmt.format(utc(date));
/** `2026-10-18` → `Oct 18` */
export const formatShortDate = (date: string) => shortDateFmt.format(utc(date));
/** `2026-10` → `October 2026` */
export const formatMonth = (month: string) => monthFmt.format(utc(`${month}-01`));
/** ISO timestamp → `18 Oct 2026, 10:02` in the viewer's time zone. */
export const formatDateTime = (iso: string) => dateTimeFmt.format(new Date(iso));
/** `2026-10-01`, `2026-10-31` → `1 Oct – 31 Oct 2026` */
export function formatRange(from: string, to: string): string {
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  return `${sameYear ? dayMonthFmt.format(utc(from)) : formatDate(from)} – ${formatDate(to)}`;
}

/** `2026-10` → `2026-09` / `2026-11` */
export function shiftMonth(month: string, delta: number): string {
  const d = utc(`${month}-01`);
  d.setUTCMonth(d.getUTCMonth() + delta);
  return d.toISOString().slice(0, 7);
}

export const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  cash: 'Cash',
  bank: 'Bank',
  credit_card: 'Credit card',
  e_wallet: 'E-wallet',
  investment: 'Investment',
};

export function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]!.toUpperCase())
      .join('') || '?'
  );
}
