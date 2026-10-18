import {
  currentMonth,
  monthSchema,
  type Account,
  type MonthlySummary,
  type Transaction,
} from '@ft/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { MonthPicker } from '@/components/filters';
import { PlusIcon } from '@/components/icons';
import { SummaryView } from '@/components/summary-view';
import { formatMonth, formatShortDate, txAmount } from '@/lib/format';
import { serverApi } from '@/lib/server-api';

export const metadata: Metadata = { title: 'Dashboard' };

const RECENT = 5;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const requested = (await searchParams).month;
  const month = monthSchema.safeParse(requested).success ? requested! : currentMonth();
  const [summary, transactions, accounts] = await Promise.all([
    serverApi<MonthlySummary>(`/summary/monthly?month=${month}`),
    serverApi<Transaction[]>(`/transactions?month=${month}`),
    serverApi<Account[]>('/accounts'),
  ]);
  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const recent = transactions.slice(0, RECENT);

  return (
    <main className="p-4 p-lg-5 d-flex flex-column gap-4">
      <header className="d-flex flex-wrap justify-content-between align-items-center gap-3">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="text-secondary m-0">Your money in and out in {formatMonth(month)}.</p>
        </div>
        <div className="d-flex flex-wrap align-items-center gap-2">
          <MonthPicker month={month} />
          <Link
            href="/transactions"
            className="btn btn-primary d-inline-flex align-items-center gap-2"
          >
            <PlusIcon size={16} /> Add transaction
          </Link>
        </div>
      </header>

      <SummaryView summary={summary} />

      <section className="surface" aria-labelledby="recent-title">
        <div className="d-flex justify-content-between align-items-center px-4 pt-3 pb-2">
          <h2 id="recent-title" className="h6 fw-bolder m-0">
            Recent transactions
          </h2>
          <Link href={`/transactions?month=${month}`} className="small fw-bold">
            View all
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="px-4 pb-4 m-0 text-secondary small">No transactions in this month.</p>
        ) : (
          <div className="overflow-auto">
            <table className="table ft-table m-0" style={{ minWidth: 560 }}>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Category</th>
                  <th scope="col">Account</th>
                  <th scope="col">Description</th>
                  <th scope="col" className="text-end">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {recent.map((t) => {
                  const account = accountById.get(t.accountId);
                  return (
                    <tr key={t.id}>
                      <td className="num text-secondary">{formatShortDate(t.occurredOn)}</td>
                      <td>
                        <span className={`pill pill-${t.type}`}>{t.category}</span>
                      </td>
                      <td>{account?.name}</td>
                      <td className="text-secondary">{t.description ?? '—'}</td>
                      <td
                        className={`num text-end fw-semibold ${t.type === 'income' ? 'text-income' : 'text-expense'}`}
                      >
                        {txAmount(t.amountMinor, account?.currency ?? 'USD', t.type)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
