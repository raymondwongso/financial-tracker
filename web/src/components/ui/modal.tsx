"use client";

import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";

interface Props {
  title: string;
  subtitle?: string;
  onClose: () => void;
  wide?: boolean;
  children: ReactNode;
}

export function Modal({ title, subtitle, onClose, wide, children }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start overflow-y-auto bg-black/70"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`mt-auto w-full border-2 border-ink bg-bg shadow-[0_24px_60px_rgba(0,0,0,.5)] md:m-auto md:p-0 ${wide ? "md:max-w-[880px]" : "md:max-w-[480px]"}`}
      >
        <div className="flex items-center justify-between gap-3 border-b-2 border-ink px-5 py-4">
          <div>
            <h2 className="text-xl font-extrabold">{title}</h2>
            {subtitle && <p className="text-[13px] text-muted">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-10 w-10 shrink-0 items-center justify-center border-2 border-ink hover:bg-ink hover:text-bg"
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>
        <div className="flex flex-col gap-[18px] p-5">{children}</div>
      </div>
    </div>
  );
}
