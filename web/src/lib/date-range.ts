export type Preset = "all" | "mtd" | "1m" | "3m" | "6m" | "ytd" | "custom";

export interface DateRange {
  preset: Preset;
  from: string;
  to: string;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Local-time `YYYY-MM-DD`. */
export function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Converts a picked `YYYY-MM-DD` (local) into the API's `occurredAt`.
 * Today (or later) returns undefined so the server keeps the real time; a past
 * day maps to local noon, which keeps it on the same calendar day in any nearby timezone.
 */
export function occurredAtForDate(date: string, now = new Date()): string | undefined {
  if (date >= toIsoDate(now)) return undefined;
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y!, m! - 1, d!, 12).toISOString();
}

function monthsAgo(today: Date, n: number): Date {
  const d = new Date(today.getFullYear(), today.getMonth() - n, 1);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(today.getDate(), lastDay));
  return d;
}

/** `all` has empty bounds (no filter). Inclusive of the whole `to` day. */
export function rangeForPreset(preset: Exclude<Preset, "custom">, today = new Date()): DateRange {
  const to = toIsoDate(today);
  switch (preset) {
    case "all":
      return { preset, from: "", to: "" };
    case "mtd":
      return { preset, from: toIsoDate(new Date(today.getFullYear(), today.getMonth(), 1)), to };
    case "ytd":
      return { preset, from: toIsoDate(new Date(today.getFullYear(), 0, 1)), to };
    case "1m":
      return { preset, from: toIsoDate(monthsAgo(today, 1)), to };
    case "3m":
      return { preset, from: toIsoDate(monthsAgo(today, 3)), to };
    case "6m":
      return { preset, from: toIsoDate(monthsAgo(today, 6)), to };
  }
}

export function rangeLabel(range: DateRange, fmt: (iso: string) => string): string {
  if (!range.from && !range.to) return "All time";
  const f = (d: string) => (d ? fmt(`${d}T00:00:00`) : "…");
  return `${f(range.from)} – ${f(range.to)}`;
}
