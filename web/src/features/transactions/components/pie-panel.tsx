import type { CategoryTotal } from "@financialtracker/shared";
import { formatIdr } from "@/lib/format";

const INCOME_COLORS = ["#22a35a", "#7fe0ab", "#15703d", "#c4f2d8", "#3cc27a", "#0e4d2a", "#5fd99a"];
const EXPENSE_COLORS = ["#ec3013", "#ff9a86", "#9e1a05", "#f2563c", "#fbd0c6", "#c2340f", "#ff7a62", "#6b1406", "#e8806a"];

export function percent(part: number, total: number): string {
  return total > 0 ? `${((part / total) * 100).toFixed(1).replace(".", ",")}%` : "0,0%";
}

export function PiePanel({ title, kind, rows }: { title: string; kind: "income" | "expense"; rows: CategoryTotal[] }) {
  const palette = kind === "income" ? INCOME_COLORS : EXPENSE_COLORS;
  const total = rows.reduce((s, r) => s + r.amount, 0);
  const stops = rows.map((r, i) => {
    const before = rows.slice(0, i).reduce((s, x) => s + x.amount, 0);
    const from = (before / total) * 100;
    const to = ((before + r.amount) / total) * 100;
    return `${palette[i % palette.length]} ${from}% ${to}%`;
  });

  return (
    <section>
      <header className="flex items-baseline justify-between border-b-2 border-ink pb-2">
        <h3 className="text-lg font-extrabold">{title}</h3>
        <span className={`font-semibold ${kind === "income" ? "text-income-text" : "text-expense-text"}`}>{formatIdr(total)}</span>
      </header>
      {rows.length === 0 ? (
        <p className="py-6 text-muted">No {kind} in this period.</p>
      ) : (
        <>
          <div
            className="mx-auto my-5 h-[200px] w-[200px] rounded-full"
            style={{ background: `conic-gradient(${stops.join(", ")})` }}
            role="img"
            aria-label={`${title} by category`}
          />
          <ul>
            {rows.map((r, i) => (
              <li key={r.categoryId} className="flex items-center gap-3 border-b border-grid py-2 text-sm">
                <span className="h-3.5 w-3.5 shrink-0" style={{ background: palette[i % palette.length] }} />
                <span className="min-w-0 flex-1 truncate">{r.categoryName}</span>
                <span className="font-semibold">{formatIdr(r.amount)}</span>
                <span className="w-14 text-right text-muted">{percent(r.amount, total)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
