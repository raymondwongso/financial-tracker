import type { ButtonHTMLAttributes, ReactNode } from "react";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: ReactNode;
  block?: boolean;
}

/** Primary lavender button; label flush-left, icon right. */
export function PrimaryButton({ icon, block, children, className = "", ...rest }: Props) {
  return (
    <button
      {...rest}
      className={`flex items-center justify-between gap-3 bg-primary px-4 py-3.5 font-semibold text-bg hover:bg-primary-hover active:bg-primary-pressed disabled:opacity-60 ${block ? "w-full" : ""} ${className}`}
    >
      <span>{children}</span>
      {icon}
    </button>
  );
}
