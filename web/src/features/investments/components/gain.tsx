import { formatGain } from "@/lib/format";

/** Gain/loss in IDR with sign colour; `—` while no price is known. */
export function Gain({ value, base }: { value: number | null; base?: number }) {
  if (value === null) return <span className="text-muted">—</span>;
  const cls = value < 0 ? "text-expense-text" : value > 0 ? "text-income-text" : "";
  const pct = base && base > 0 ? ` (${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs((value / base) * 100).toFixed(1).replace(".", ",")}%)` : "";
  return (
    <span className={cls}>
      {formatGain(value)}
      {pct}
    </span>
  );
}
