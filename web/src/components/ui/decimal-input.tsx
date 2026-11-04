"use client";

import { formatDecimalInput, parseDecimalInput } from "@/lib/format";

interface Props {
  id?: string;
  value: string; // digits with an optional "." (shown grouped: 1.250.000,5)
  onChange: (value: string) => void;
  maxDecimals: number;
  prefix?: string;
  suffix?: string;
}

/** Decimal counterpart of `AmountInput`, for quantities (grams, shares) and unit prices. */
export function DecimalInput({ id, value, onChange, maxDecimals, prefix, suffix }: Props) {
  const addon = "flex items-center bg-surface-hover px-3.5 font-semibold text-muted";
  return (
    <div className="flex border-2 border-ink focus-within:border-primary">
      {prefix && <span className={addon}>{prefix}</span>}
      <input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        placeholder="0"
        value={formatDecimalInput(value)}
        onChange={(e) => onChange(parseDecimalInput(e.target.value, maxDecimals))}
        className="w-full bg-surface px-3.5 py-3 text-[22px] font-semibold text-ink focus:outline-none"
      />
      {suffix && <span className={addon}>{suffix}</span>}
    </div>
  );
}
