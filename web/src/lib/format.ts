const idr = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });

/** `Rp 1.250.000`, negatives as `−Rp 50.000`. */
export function formatIdr(amount: number): string {
  const body = `Rp ${idr.format(Math.abs(amount))}`;
  return amount < 0 ? `−${body}` : body;
}

/** Digits-only string → `1.000` for display in amount inputs. */
export function formatDigits(digits: string): string {
  return digits ? idr.format(Number(digits)) : "";
}

/** Strips non-digits and leading zeros, max 15 digits. */
export function sanitizeDigits(raw: string): string {
  return raw.replace(/\D/g, "").replace(/^0+/, "").slice(0, 15);
}

const UNITS: [number, string][] = [
  [1e12, "Tio"],
  [1e9, "Bio"],
  [1e6, "Mio"],
  [1e3, "K"],
];

/** `3,3 Mio`, `500 K`, `950`: at most one decimal with a comma. */
export function formatAbbrev(amount: number): string {
  const sign = amount < 0 ? "−" : "";
  const abs = Math.abs(amount);
  for (const [size, unit] of UNITS) {
    if (abs >= size) {
      const v = Math.round((abs / size) * 10) / 10;
      return `${sign}${String(v).replace(".", ",")} ${unit}`;
    }
  }
  return `${sign}${abs}`;
}

const longDate = new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", year: "numeric" });

/** `26 Oct 2026` */
export function formatDate(iso: string): string {
  const parts = longDate.formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("day")} ${get("month")} ${get("year")}`;
}

/** `26/10/26` */
export function formatDateShort(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${String(d.getFullYear()).slice(-2)}`;
}

export function initials(first: string, last: string): string {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

const qty = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 6 });
const price = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 });

/** Units held: `2,5` grams, `1.200` shares (up to 6 decimals). */
export function formatQuantity(n: number): string {
  return qty.format(n);
}

/** Per-unit price: `Rp 5.500`, keeps up to 2 decimals (`Rp 5.500,5`). */
export function formatPrice(n: number): string {
  return `Rp ${price.format(n)}`;
}

/** `+Rp 200.000` / `−Rp 50.000`: gains get an explicit sign. */
export function formatGain(n: number): string {
  return n > 0 ? `+${formatIdr(n)}` : formatIdr(n);
}

/** Free-typed decimal → digits with at most one `.` and `maxDecimals` decimals; `,` is accepted as the separator. */
export function sanitizeDecimal(raw: string, maxDecimals: number): string {
  const cleaned = raw.replace(",", ".").replace(/[^\d.]/g, "");
  const [int = "", ...rest] = cleaned.split(".");
  const intPart = int.replace(/^0+(?=\d)/, "").slice(0, 14);
  if (rest.length === 0) return intPart;
  return `${intPart || "0"}.${rest.join("").slice(0, maxDecimals)}`;
}

/** Internal decimal string (`"1250000.5"`) → input display (`1.250.000,5`); keeps a trailing `,` and trailing zeros while typing. */
export function formatDecimalInput(value: string): string {
  if (!value) return "";
  const [int = "", dec] = value.split(".");
  const grouped = int ? idr.format(Number(int)) : "0";
  return dec === undefined ? grouped : `${grouped},${dec}`;
}

/** Typed/pasted text in the grouped display format (`.` thousands, `,` decimal) → internal decimal string. */
export function parseDecimalInput(raw: string, maxDecimals: number): string {
  return sanitizeDecimal(raw.replace(/\./g, ""), maxDecimals);
}
