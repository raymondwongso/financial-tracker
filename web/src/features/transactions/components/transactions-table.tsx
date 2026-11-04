import { Trash2 } from "lucide-react";
import type { Transaction } from "@financialtracker/shared";
import { formatAbbrev, formatDate, formatDateShort, formatIdr } from "@/lib/format";

export function TransactionsTable({ items, onDelete }: { items: Transaction[]; onDelete?: (t: Transaction) => void }) {
  if (items.length === 0) return <p className="border-t-2 border-ink py-8 text-muted">No transactions in this period.</p>;
  return (
    <div className="border-t-2 border-ink">
      <div className="hidden grid-cols-[120px_minmax(0,.9fr)_minmax(0,1.4fr)_160px_160px_40px] gap-4 border-b-2 border-ink px-2 py-3 text-xs font-semibold tracking-[0.06em] text-muted uppercase md:grid">
        <span>Date</span>
        <span>Category</span>
        <span>Description</span>
        <span className="text-right">Income</span>
        <span className="text-right">Expense</span>
        <span />
      </div>
      <div className="grid grid-cols-[64px_1.2fr_1fr_1fr_32px] gap-2 border-b-2 border-ink px-1 py-3 text-xs font-semibold tracking-[0.06em] text-muted uppercase md:hidden">
        <span>Date</span>
        <span>Category</span>
        <span className="text-right">Income</span>
        <span className="text-right">Expense</span>
        <span />
      </div>
      {items.map((t) => {
        const income = t.type === "income";
        return (
          <div key={t.id} className="group border-b border-line py-3 hover:bg-surface-hover">
            <div className="hidden grid-cols-[120px_minmax(0,.9fr)_minmax(0,1.4fr)_160px_160px_40px] gap-4 px-2 md:grid">
              <span>{formatDate(t.createdAt)}</span>
              <span className="truncate font-semibold">{t.categoryName}</span>
              <span className="truncate text-muted">{t.description}</span>
              <span className="text-right text-income-text">{income ? formatIdr(t.amount) : ""}</span>
              <span className="text-right text-expense-text">{income ? "" : formatIdr(t.amount)}</span>
              <span className="flex justify-end">
                {onDelete && (
                  <button type="button" aria-label="Delete transaction" onClick={() => onDelete(t)} className="text-muted hover:text-expense-text focus-visible:text-expense-text">
                    <Trash2 size={16} />
                  </button>
                )}
              </span>
            </div>
            <div className="grid grid-cols-[64px_1.2fr_1fr_1fr_32px] gap-2 px-1 text-sm md:hidden">
              <span>{formatDateShort(t.createdAt)}</span>
              <span>
                <span className="block font-semibold">{t.categoryName}</span>
                {t.description && <span className="block text-xs text-muted">{t.description}</span>}
              </span>
              <span className="text-right text-income-text">{income ? formatAbbrev(t.amount) : ""}</span>
              <span className="text-right text-expense-text">{income ? "" : formatAbbrev(t.amount)}</span>
              <span className="flex justify-end">
                {onDelete && (
                  <button type="button" aria-label="Delete transaction" onClick={() => onDelete(t)} className="text-muted hover:text-expense-text focus-visible:text-expense-text">
                    <Trash2 size={16} />
                  </button>
                )}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
