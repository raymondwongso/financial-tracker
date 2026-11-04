"use client";

import type { Transaction } from "@financialtracker/shared";
import { ArrowLeft, ChartPie, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { DateRangeControl } from "@/components/ui/date-range-control";
import { PAGE_SIZE, useTransactions } from "@/features/transactions/hooks";
import { SummaryModal } from "@/features/transactions/components/summary-modal";
import { DeleteTransactionModal } from "@/features/transactions/components/delete-transaction-modal";
import { TransactionsTable } from "@/features/transactions/components/transactions-table";
import { rangeForPreset, rangeLabel, type DateRange } from "@/lib/date-range";
import { formatDate, formatIdr } from "@/lib/format";
import { ApiError } from "@/lib/api-client";
import { useAccount } from "../hooks";
import { DeleteAccountModal } from "./delete-account-modal";

const PRESETS = [
  { id: "all", label: "All" },
  { id: "1m", label: "Last 1M" },
  { id: "3m", label: "Last 3M" },
  { id: "6m", label: "Last 6M" },
  { id: "mtd", label: "MTD" },
  { id: "ytd", label: "YTD" },
] as const;

const navBtn =
  "flex min-h-11 items-center gap-1 border-2 border-ink px-4 font-semibold hover:bg-ink hover:text-bg disabled:pointer-events-none disabled:opacity-40";

export function AccountDetailView({ accountId }: { accountId: number }) {
  const { data: account, error } = useAccount(accountId);
  const [range, setRange] = useState<DateRange>(() => rangeForPreset("all"));
  // Cursors of pages after the first; the last entry is the current page's cursor.
  const [cursors, setCursors] = useState<string[]>([]);
  const [summary, setSummary] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleting, setDeleting] = useState<Transaction | null>(null);
  const cursor = cursors[cursors.length - 1] ?? null;
  const { data: page } = useTransactions(accountId, range.from, range.to, cursor);

  const changeRange = (r: DateRange) => {
    setRange(r);
    setCursors([]);
  };

  if (error instanceof ApiError && error.status === 404) {
    return (
      <div className="flex flex-col gap-4">
        <Link href="/accounts" className="text-primary hover:underline">← Accounts</Link>
        <p>Account not found.</p>
      </div>
    );
  }
  if (!account) return <p className="text-muted">Loading…</p>;

  const start = cursors.length * PAGE_SIZE + 1;
  const end = start + (page?.items.length ?? 0) - 1;
  const label = rangeLabel(range, formatDate);

  return (
    <div className="flex flex-col gap-7">
      <Link href="/accounts" className="flex items-center gap-2 font-semibold text-primary hover:underline">
        <ArrowLeft size={16} /> Accounts
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-ink pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-[32px] leading-none font-extrabold tracking-[-0.025em] md:text-5xl">{account.name}</h1>
            <button type="button" aria-label="Summary" onClick={() => setSummary(true)} className="flex h-9 w-9 items-center justify-center border-2 border-ink hover:bg-ink hover:text-bg">
              <ChartPie size={18} />
            </button>
            <button type="button" aria-label="Delete account" onClick={() => setDeletingAccount(true)} className="flex h-9 w-9 items-center justify-center border-2 border-ink text-muted hover:border-expense-text hover:text-expense-text">
              <Trash2 size={18} />
            </button>
          </div>
          {account.description && <p className="mt-2 text-muted">{account.description}</p>}
        </div>
        <div className="md:text-right">
          <p className="text-xs font-semibold tracking-[0.08em] text-muted uppercase">Final balance</p>
          <p className={`text-[30px] font-extrabold md:text-[40px] ${account.balance < 0 ? "text-expense-text" : ""}`}>{formatIdr(account.balance)}</p>
        </div>
      </div>

      <DateRangeControl value={range} onChange={changeRange} presets={[...PRESETS]} />

      <TransactionsTable items={page?.items ?? []} onDelete={setDeleting} />

      {page && page.total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-muted">
            Showing {start}–{end} of {page.total}
          </p>
          <div className="flex gap-2">
            <button type="button" className={navBtn} disabled={cursors.length === 0} onClick={() => setCursors((c) => c.slice(0, -1))}>
              <ChevronLeft size={16} /> Newer
            </button>
            <button type="button" className={navBtn} disabled={!page.nextCursor} onClick={() => page.nextCursor && setCursors((c) => [...c, page.nextCursor!])}>
              Older <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {deleting && (
        <DeleteTransactionModal transaction={deleting} onClose={() => setDeleting(null)} onDeleted={() => setCursors([])} />
      )}

      {summary && (
        <SummaryModal accountId={accountId} accountName={account.name} from={range.from} to={range.to} rangeText={label} onClose={() => setSummary(false)} />
      )}

      {deletingAccount && <DeleteAccountModal account={account} onClose={() => setDeletingAccount(false)} />}
    </div>
  );
}
