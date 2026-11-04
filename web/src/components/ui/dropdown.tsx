"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

export interface Option {
  value: number;
  label: string;
  hint?: string;
}

interface Props {
  id?: string;
  value: number | null;
  options: Option[];
  placeholder: string;
  onChange: (value: number) => void;
  /** Rendered as the last row inside the list (e.g. "+ Create new"). */
  footer?: (close: () => void) => ReactNode;
}

export function Dropdown({ id, value, options, placeholder, onChange, footer }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between border-2 border-ink bg-surface px-3.5 py-3 text-left hover:bg-surface-hover"
      >
        <span className={selected ? "" : "text-muted"}>{selected?.label ?? placeholder}</span>
        <ChevronDown size={18} />
      </button>
      {open && (
        <div className="absolute z-10 mt-0.5 max-h-64 w-full overflow-y-auto border-2 border-ink bg-surface">
          <ul role="listbox">
            {options.map((o) => (
              <li key={o.value} role="option" aria-selected={o.value === value}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left hover:bg-surface-hover ${o.value === value ? "bg-surface-hover" : ""}`}
                >
                  <span>{o.label}</span>
                  {o.hint && <span className="text-[13px] text-muted">{o.hint}</span>}
                </button>
              </li>
            ))}
          </ul>
          {footer?.(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}
