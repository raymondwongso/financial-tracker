import type { AccountTotals } from "@financialtracker/shared";
import { formatAbbrev, formatIdr } from "@/lib/format";
import { niceScale } from "../nice-scale";

function Bar({ value, max, kind }: { value: number; max: number; kind: "income" | "expense" }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  const inside = pct > 72;
  const white = kind === "income";
  const label = formatAbbrev(value);
  const title = `${white ? "Income" : "Expense"} ${formatIdr(value)}`;
  return (
    <div className="relative h-[22px]" title={title}>
      <div className={`h-full transition-[width] duration-300 ease-in-out ${white ? "bg-ink" : "bg-expense"}`} style={{ width: `${pct}%` }} />
      <span
        className={`absolute top-0 flex h-full items-center text-xs font-semibold ${inside ? (white ? "text-bg" : "text-white") : white ? "text-ink" : "text-expense-text"}`}
        style={inside ? { right: `${100 - pct + 1}%` } : { left: `calc(${pct}% + 6px)` }}
      >
        {label}
      </span>
    </div>
  );
}

export function AccountBarChart({ accounts }: { accounts: AccountTotals[] }) {
  const maxValue = Math.max(0, ...accounts.flatMap((a) => [a.income, a.expense]));
  const { max, step } = niceScale(maxValue);
  const ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, i) => i * step);

  return (
    <div className="border-y-2 border-ink" role="img" aria-label="Income and expense by account">
      <div className="grid grid-cols-[92px_1fr] md:grid-cols-[180px_1fr]">
        {accounts.map((a) => (
          <div key={a.accountId} className="contents">
            <div className="flex items-center border-r-2 border-b border-ink border-b-line px-2 py-3 text-sm font-semibold break-words">{a.accountName}</div>
            <div className="relative flex flex-col gap-1.5 border-b border-line px-3 py-3">
              {ticks.map((t) => (
                <span key={t} className="pointer-events-none absolute inset-y-0 w-px bg-grid" style={{ left: `calc(12px + (100% - 24px) * ${t / max})` }} />
              ))}
              <div className="relative flex flex-col gap-1.5">
                <Bar value={a.income} max={max} kind="income" />
                <Bar value={a.expense} max={max} kind="expense" />
              </div>
            </div>
          </div>
        ))}
        <div className="border-r-2 border-ink px-2 py-2 text-xs font-semibold text-muted">IDR</div>
        <div className="relative h-8 px-3">
          {ticks.map((t, i) => (
            <span
              key={t}
              className={`absolute top-2 text-xs text-muted ${i === 0 ? "" : i === ticks.length - 1 ? "-translate-x-full" : "-translate-x-1/2"}`}
              style={{ left: `calc(12px + (100% - 24px) * ${t / max})` }}
            >
              {formatAbbrev(t)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
