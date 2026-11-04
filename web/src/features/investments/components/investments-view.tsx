"use client";

import { ArrowDown, ArrowUp, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { InvestmentListQuery, InvestmentSortKey } from "@financialtracker/shared";
import { PrimaryButton } from "@/components/ui/button";
import { formatDate, formatIdr, formatPrice, formatQuantity } from "@/lib/format";
import { useInvestmentAccounts } from "../hooks";
import { CreateInvestmentAccountModal } from "./create-investment-account-modal";
import { Gain } from "./gain";
import { SortableHeader } from "./sortable-header";

const COLS = "grid-cols-[minmax(140px,1.2fr)_90px_minmax(110px,1fr)_minmax(120px,1fr)_minmax(140px,1.1fr)_minmax(130px,1fr)_minmax(150px,1.1fr)]";
const SORT_OPTIONS: Array<{ key: InvestmentSortKey; label: string }> = [
  { key: "name", label: "Name" },
  { key: "value", label: "Value" },
  { key: "gain", label: "Gain / loss" },
];
const label = "text-xs font-semibold tracking-[0.08em] text-muted uppercase";

export function InvestmentsView() {
  const router = useRouter();
  const [sort, setSort] = useState<InvestmentListQuery>({});
  const { data, isPending, isError } = useInvestmentAccounts(sort);
  const [creating, setCreating] = useState(false);
  const open = (id: number) => router.push(`/investments/${id}`);
  const items = data?.items ?? [];

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className={label}>
            {items.length} {items.length === 1 ? "investment" : "investments"}
          </p>
          <h1 className="text-[32px] leading-none font-extrabold tracking-[-0.025em] md:text-5xl">Investments</h1>
        </div>
        <PrimaryButton icon={<Plus size={18} />} onClick={() => setCreating(true)}>
          New investment account
        </PrimaryButton>
      </div>

      {isPending && <p className="text-muted">Loading…</p>}
      {isError && <p className="text-expense-text">Could not load investments.</p>}
      {data && items.length === 0 && <p className="text-muted">No investment accounts yet. Create your first one.</p>}

      {data && items.length > 0 && (
        <>
          <dl className="grid grid-cols-1 gap-4 border-y-2 border-ink py-4 sm:grid-cols-3">
            <div><dt className={label}>Total cost</dt><dd className="text-2xl font-extrabold">{formatIdr(data.summary.totalCost)}</dd></div>
            <div><dt className={label}>Total value</dt><dd className="text-2xl font-extrabold">{data.summary.totalValue === null ? "—" : formatIdr(data.summary.totalValue)}</dd></div>
            <div><dt className={label}>Unrealized gain</dt><dd className="text-2xl font-extrabold"><Gain value={data.summary.unrealizedGain} base={data.summary.totalCost} /></dd></div>
          </dl>

          <div className="hidden md:block">
            <div role="row" className={`grid ${COLS} gap-4 border-b-2 border-ink px-2 py-3 ${label}`}>
              <SortableHeader label="Name" sortKey="name" sort={sort} onSort={setSort} /><span>Type</span><span className="text-right">Quantity</span><span className="text-right">Avg buy price</span><span className="text-right">Current price</span><SortableHeader label="Value" sortKey="value" sort={sort} onSort={setSort} align="right" /><SortableHeader label="Gain / loss" sortKey="gain" sort={sort} onSort={setSort} align="right" />
            </div>
            {items.map((a) => (
              <div key={a.id} role="link" tabIndex={0} onClick={() => open(a.id)} onKeyDown={(e) => e.key === "Enter" && open(a.id)} className={`grid ${COLS} cursor-pointer gap-4 border-b border-line px-2 py-4 hover:bg-surface-hover`}>
                <span className="font-semibold">{a.name}<span className="block text-xs font-normal text-muted">{a.symbol}</span></span>
                <span className="capitalize">{a.assetType}</span>
                <span className="text-right">{formatQuantity(a.quantity)} {a.unit === "gram" ? "g" : ""}</span>
                <span className="text-right">{a.quantity > 0 ? formatPrice(a.avgCost) : "—"}</span>
                <span className="text-right">{a.currentPrice === null ? "—" : formatPrice(a.currentPrice)}{a.priceUpdatedAt && <span className="block text-xs text-muted">{formatDate(a.priceUpdatedAt)}</span>}</span>
                <span className="text-right font-semibold">{a.marketValue === null ? "—" : formatIdr(a.marketValue)}</span>
                <span className="text-right"><Gain value={a.unrealizedGain} base={a.totalCost} /></span>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 md:hidden">
            <label htmlFor="investment-sort" className={label}>Sort by</label>
            <select
              id="investment-sort"
              value={sort.sortBy ?? ""}
              onChange={(e) => {
                const key = SORT_OPTIONS.find((o) => o.key === e.target.value)?.key;
                setSort(key ? { sortBy: key, order: sort.order ?? "asc" } : {});
              }}
              className="border-2 border-ink bg-surface px-2 py-1.5 text-sm text-ink"
            >
              <option value="">Newest first</option>
              {SORT_OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>{o.label}</option>
              ))}
            </select>
            {sort.sortBy && (
              <button
                type="button"
                onClick={() => setSort({ sortBy: sort.sortBy, order: sort.order === "desc" ? "asc" : "desc" })}
                aria-label={sort.order === "desc" ? "Sort descending, switch to ascending" : "Sort ascending, switch to descending"}
                className="border-2 border-ink p-1.5 hover:bg-surface-hover"
              >
                {sort.order === "desc" ? <ArrowDown size={16} aria-hidden /> : <ArrowUp size={16} aria-hidden />}
              </button>
            )}
          </div>

          <div className="flex flex-col border-t-2 border-ink md:hidden">
            {items.map((a) => (
              <button key={a.id} type="button" onClick={() => open(a.id)} className="flex flex-col gap-1 border-b border-line py-4 text-left hover:bg-surface-hover">
                <span className="flex justify-between gap-3"><span className="font-semibold">{a.name} <span className="text-xs font-normal text-muted">{a.symbol}</span></span><span className="font-semibold">{a.marketValue === null ? "—" : formatIdr(a.marketValue)}</span></span>
                <span className="text-sm text-muted">{formatQuantity(a.quantity)} {a.unit}s · avg {a.quantity > 0 ? formatPrice(a.avgCost) : "—"}</span>
                <span className="text-sm"><Gain value={a.unrealizedGain} base={a.totalCost} /></span>
              </button>
            ))}
          </div>
        </>
      )}

      {creating && <CreateInvestmentAccountModal onClose={() => setCreating(false)} />}
    </div>
  );
}
