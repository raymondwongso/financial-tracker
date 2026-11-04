"use client";

import { rangeForPreset, type DateRange, type Preset } from "@/lib/date-range";

interface Props {
  value: DateRange;
  onChange: (range: DateRange) => void;
  presets: { id: Exclude<Preset, "custom">; label: string }[];
}

const dateInput =
  "min-h-11 border-2 border-ink bg-surface px-3 text-[13px] text-ink focus:border-primary";

export function DateRangeControl({ value, onChange, presets }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div role="group" aria-label="Date range presets" className="flex gap-0.5 border-2 border-ink bg-ink">
        {presets.map((p) => (
          <button
            key={p.id}
            type="button"
            aria-pressed={value.preset === p.id}
            onClick={() => onChange(rangeForPreset(p.id))}
            className={`min-h-10 px-3.5 text-[13px] font-semibold ${value.preset === p.id ? "bg-ink text-bg" : "bg-bg text-ink hover:bg-surface-hover"}`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <label className="flex items-center gap-2 text-[13px] font-semibold text-muted">
        From
        <input
          type="date"
          aria-label="From"
          className={dateInput}
          value={value.from}
          max={value.to || undefined}
          onChange={(e) => onChange({ preset: "custom", from: e.target.value, to: value.to })}
        />
      </label>
      <label className="flex items-center gap-2 text-[13px] font-semibold text-muted">
        To
        <input
          type="date"
          aria-label="To"
          className={dateInput}
          value={value.to}
          min={value.from || undefined}
          onChange={(e) => onChange({ preset: "custom", from: value.from, to: e.target.value })}
        />
      </label>
    </div>
  );
}
