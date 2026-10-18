'use client';

import type { MonthlySummary } from '@ft/shared';
import { useState } from 'react';
import { money } from '@/lib/format';

/**
 * Monthly totals for one currency at a time: income / expenses / net tiles, income vs expenses
 * per account and top expense categories. Used by the dashboard and the chat summary card.
 */
export function SummaryView({
  summary,
  compact = false,
}: {
  summary: MonthlySummary;
  compact?: boolean;
}) {
  const currencies = summary.totals.map((t) => t.currency);
  const [selected, setSelected] = useState(currencies[0]);
  const currency = selected && currencies.includes(selected) ? selected : currencies[0];

  if (!currency) {
    return (
      <div className="surface p-4 text-center text-secondary" role="status">
        No transactions in this month yet.
      </div>
    );
  }

  const totals = summary.totals.find((t) => t.currency === currency)!;
  const accounts = summary.byAccount.filter((a) => a.currency === currency);
  const maxAccount = Math.max(1, ...accounts.flatMap((a) => [a.incomeMinor, a.expenseMinor]));
  const categories = summary.byCategory
    .filter((c) => c.currency === currency && c.type === 'expense')
    .slice(0, 5);
  const maxCategory = Math.max(1, ...categories.map((c) => c.totalMinor));
  const keptPct =
    totals.incomeMinor > 0 ? Math.round((totals.netMinor / totals.incomeMinor) * 100) : null;
  const pct = (value: number, max: number) => `${Math.max(2, Math.round((value / max) * 100))}%`;

  return (
    <div className="d-flex flex-column gap-3">
      {currencies.length > 1 ? (
        <div role="tablist" aria-label="Currency" className="d-flex gap-2">
          {currencies.map((c) => (
            <button
              key={c}
              type="button"
              role="tab"
              className="chip-tab"
              aria-selected={c === currency}
              onClick={() => setSelected(c)}
            >
              {c}
            </button>
          ))}
        </div>
      ) : null}

      <section
        aria-label="Monthly totals"
        className={compact ? 'd-grid gap-2 stats-compact' : 'd-grid gap-3'}
        style={{
          gridTemplateColumns: compact
            ? 'repeat(auto-fit, minmax(110px, 1fr))'
            : 'repeat(auto-fit, minmax(200px, 1fr))',
        }}
      >
        <div className="surface stat-tile">
          <span className="eyebrow">Income</span>
          <span className="stat-value text-income">
            {money(totals.incomeMinor, currency, { signed: true })}
          </span>
        </div>
        <div className="surface stat-tile">
          <span className="eyebrow">Expenses</span>
          <span className="stat-value text-expense">
            {money(-totals.expenseMinor, currency, { signed: true })}
          </span>
        </div>
        <div className="surface stat-tile stat-net">
          <span className="eyebrow">Net</span>
          <span className="stat-value">{money(totals.netMinor, currency, { signed: true })}</span>
          {!compact && keptPct !== null ? (
            <span className="small" style={{ color: '#C9D4E8' }}>
              You kept {keptPct}% of income
            </span>
          ) : null}
        </div>
      </section>

      <div className={compact ? 'd-flex flex-column gap-3' : 'd-flex flex-wrap gap-3'}>
        <section
          className="surface p-3 flex-grow-1"
          style={compact ? undefined : { flexBasis: 320 }}
          aria-label="Income vs expenses by account"
        >
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
            <h2 className="h6 fw-bolder m-0">Income vs expenses by account</h2>
            <span className="d-flex gap-3 small text-secondary">
              <span className="d-flex align-items-center gap-1">
                <span className="legend-dot income" /> Income
              </span>
              <span className="d-flex align-items-center gap-1">
                <span className="legend-dot expense" /> Expenses
              </span>
            </span>
          </div>
          <div className="d-flex flex-column gap-3">
            {accounts.map((a) => (
              <div key={a.accountId} className="d-flex flex-column gap-1">
                <span className="small fw-bold">{a.accountName}</span>
                <div className="bar-track" title={`Income ${money(a.incomeMinor, currency)}`}>
                  <span className="bar-income" style={{ width: pct(a.incomeMinor, maxAccount) }} />
                </div>
                <div className="bar-track" title={`Expenses ${money(a.expenseMinor, currency)}`}>
                  <span
                    className="bar-expense"
                    style={{ width: pct(a.expenseMinor, maxAccount) }}
                  />
                </div>
                <span className="num small text-secondary">
                  {money(a.incomeMinor, currency, { signed: true })} ·{' '}
                  {money(-a.expenseMinor, currency, { signed: true })}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section
          className="surface p-3 flex-grow-1"
          style={compact ? undefined : { flexBasis: 260 }}
          aria-label="Top expense categories"
        >
          <h2 className="h6 fw-bolder mb-3">Top expense categories</h2>
          {categories.length === 0 ? (
            <p className="small text-secondary m-0">No expenses this month.</p>
          ) : (
            <div className="d-flex flex-column gap-3">
              {categories.map((c) => (
                <div key={c.category} className="d-flex flex-column gap-1">
                  <div className="d-flex justify-content-between small">
                    <span className="fw-semibold">{c.category}</span>
                    <span className="num">{money(c.totalMinor, currency)}</span>
                  </div>
                  <div className="bar-track">
                    <span
                      className="bar-expense"
                      style={{ width: pct(c.totalMinor, maxCategory) }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
