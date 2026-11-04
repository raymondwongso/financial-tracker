"use client";

import Link from "next/link";
import { useState } from "react";
import { DateRangeControl } from "@/components/ui/date-range-control";
import { useMe } from "@/features/auth/hooks";
import { formatDate, formatIdr } from "@/lib/format";
import { rangeForPreset, rangeLabel, type DateRange } from "@/lib/date-range";
import { useDashboardSummary } from "../hooks";
import { AccountBarChart } from "./account-bar-chart";
import { TotalAssetsSection } from "./total-assets-section";

const PRESETS = [
  { id: "mtd", label: "MTD" },
  { id: "1m", label: "1M" },
  { id: "3m", label: "3M" },
  { id: "6m", label: "6M" },
  { id: "ytd", label: "YTD" },
] as const;

export function DashboardView() {
  const { data: me } = useMe();
  const [range, setRange] = useState<DateRange>(() => rangeForPreset("mtd"));
  const { data, isPending, isError } = useDashboardSummary(range.from, range.to);

  const accounts = data?.accounts ?? [];
  const income = accounts.reduce((s, a) => s + a.income, 0);
  const expense = accounts.reduce((s, a) => s + a.expense, 0);

  return (
    <div className="flex flex-col gap-7">
      <div className="border-b-2 border-ink pb-5">
        <p className="text-xs font-semibold tracking-[0.08em] text-muted uppercase">Dashboard</p>
        <h1 className="text-[32px] leading-none font-extrabold tracking-[-0.025em] md:text-5xl">
          Welcome {me?.firstName} {me?.lastName}
        </h1>
      </div>

      <TotalAssetsSection />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-[22px] font-extrabold tracking-[-0.01em]">Income and expense by account</h2>
          <p className="text-[13px] text-muted">{rangeLabel(range, formatDate)}</p>
        </div>
        <DateRangeControl value={range} onChange={setRange} presets={[...PRESETS]} />
      </div>

      {isPending && <p className="text-muted">Loading…</p>}
      {isError && <p className="text-expense-text">Could not load the dashboard.</p>}

      {data && accounts.length === 0 && (
        <div className="flex flex-col items-start gap-4 border-y-2 border-ink py-10">
          <p className="text-lg font-semibold">No accounts yet</p>
          <Link href="/accounts" className="bg-primary px-4 py-3 font-semibold text-bg hover:bg-primary-hover">
            Go to Account
          </Link>
        </div>
      )}

      {accounts.length > 0 && (
        <>
          <div className="flex flex-wrap gap-x-8 gap-y-2">
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 bg-ink" /> Income <b>{formatIdr(income)}</b>
            </span>
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 bg-expense" /> Expense <b>{formatIdr(expense)}</b>
            </span>
          </div>
          <AccountBarChart accounts={accounts} />
        </>
      )}
    </div>
  );
}
