import { ArrowDown, ArrowUp } from "lucide-react";
import type { InvestmentListQuery, InvestmentSortKey } from "@financialtracker/shared";

/** Next sort after clicking a header: a new column starts ascending, the active one flips. */
export function nextSort(current: InvestmentListQuery, key: InvestmentSortKey): InvestmentListQuery {
  if (current.sortBy !== key) return { sortBy: key, order: "asc" };
  return { sortBy: key, order: current.order === "desc" ? "asc" : "desc" };
}

interface Props {
  label: string;
  sortKey: InvestmentSortKey;
  sort: InvestmentListQuery;
  onSort: (next: InvestmentListQuery) => void;
  align?: "left" | "right";
}

export function SortableHeader({ label, sortKey, sort, onSort, align = "left" }: Props) {
  const active = sort.sortBy === sortKey;
  const desc = active && sort.order === "desc";
  return (
    <span
      role="columnheader"
      aria-sort={active ? (desc ? "descending" : "ascending") : "none"}
      className={align === "right" ? "text-right" : ""}
    >
      <button
        type="button"
        onClick={() => onSort(nextSort(sort, sortKey))}
        className={`inline-flex cursor-pointer items-center gap-1 uppercase hover:text-ink ${active ? "text-ink" : ""}`}
      >
        {label}
        {active && (desc ? <ArrowDown size={14} aria-hidden /> : <ArrowUp size={14} aria-hidden />)}
      </button>
    </span>
  );
}
