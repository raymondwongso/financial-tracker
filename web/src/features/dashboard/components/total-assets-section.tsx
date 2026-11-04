"use client";

import { formatIdr } from "@/lib/format";
import { useTotalAssets } from "../hooks";

const label = "text-xs font-semibold tracking-[0.08em] text-muted uppercase";

const share = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0);

export function TotalAssetsSection() {
  const { data, isPending, isError } = useTotalAssets();

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-[22px] font-extrabold tracking-[-0.01em]">Total assets</h2>

      {isPending && <p className="text-muted">Loading…</p>}
      {isError && <p className="text-expense-text">Could not load total assets.</p>}

      {data && (
        <div className="flex flex-col gap-4 border-y-2 border-ink py-4">
          <p className="text-2xl font-extrabold tabular-nums">{formatIdr(data.total)}</p>

          {data.total > 0 && data.accountsTotal >= 0 && (
            <div className="flex h-3 w-full" role="img" aria-label="Accounts versus investments">
              <div className="bg-ink" style={{ width: `${(data.accountsTotal / data.total) * 100}%` }} />
              <div className="bg-primary" style={{ width: `${(data.investmentsTotal / data.total) * 100}%` }} />
            </div>
          )}

          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <dt className={label}>Accounts</dt>
              <dd className="font-bold tabular-nums">
                {formatIdr(data.accountsTotal)} · {share(data.accountsTotal, data.total)}%
              </dd>
            </div>
            <div>
              <dt className={label}>Investments</dt>
              <dd className="font-bold tabular-nums">
                {formatIdr(data.investmentsTotal)} · {share(data.investmentsTotal, data.total)}%
              </dd>
            </div>
          </dl>

          {data.unpricedInvestmentCount > 0 && (
            <p className="text-[13px] text-muted">
              {data.unpricedInvestmentCount === 1
                ? "1 investment position has no price and is not included."
                : `${data.unpricedInvestmentCount} investment positions have no price and are not included.`}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
