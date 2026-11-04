"use client";

import { formatDigits, sanitizeDigits } from "@/lib/format";

interface Props {
  id?: string;
  value: string; // digits only
  onChange: (digits: string) => void;
}

export function AmountInput({ id, value, onChange }: Props) {
  return (
    <div className="flex border-2 border-ink focus-within:border-primary">
      <span className="flex items-center bg-surface-hover px-3.5 font-semibold text-muted">Rp</span>
      <input
        id={id}
        inputMode="numeric"
        autoComplete="off"
        placeholder="0"
        value={formatDigits(value)}
        onChange={(e) => onChange(sanitizeDigits(e.target.value))}
        className="w-full bg-surface px-3.5 py-3 text-[22px] font-semibold text-ink focus:outline-none"
      />
    </div>
  );
}
