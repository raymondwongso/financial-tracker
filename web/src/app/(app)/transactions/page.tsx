import {
  currentMonth,
  idSchema,
  monthSchema,
  type Account,
  type TransactionWithBalance,
} from '@ft/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AccountFilter, MonthPicker } from '@/components/filters';
import { ChevronLeftIcon } from '@/components/icons';
import { ACCOUNT_TYPE_LABELS, formatDate, formatMonth, money, txAmount } from '@/lib/format';
import { serverApi } from '@/lib/server-api';
import { AddTransactionForm } from './add-transaction-form';

export const metadata: Metadata = { title: 'Transactions' };

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; accountId?: string }>;
}) {
  const params = await searchParams;
  const month = monthSchema.safeParse(params.month).success ? params.month! : currentMonth();
  const accounts = await serverApi<Account[]>('/accounts');
  const account = idSchema.safeParse(params.accountId).success
    ? accounts.find((a) => a.id === params.accountId)
    : undefined;
  const query = new URLSearchParams({ month, ...(account ? { accountId: account.id } : {}) });
  const transactions = await serverApi<TransactionWithBalance[]>(`/transactions?${query}`);
  const accountById = new Map(accounts.map((a) => [a.id, a]));

  return (
    <main className="p-4 p-lg-5 d-flex flex-column gap-4">
      {account ? (
        <>
          <Link
            href="/accounts"
            className="small fw-bold text-decoration-none d-inline-flex align-items-center gap-1"
          >
            <ChevronLeftIcon size={16} /> All accounts
          </Link>
          <header className="surface p-4 d-flex flex-wrap justify-content-between align-items-center gap-3">
            <div className="d-flex flex-column gap-1">
              <span className="d-flex gap-2 align-items-center">
                <span className="pill">{ACCOUNT_TYPE_LABELS[account.type]}</span>
                <span className="small fw-bold text-secondary">{account.currency}</span>
              </span>
              <h1 className="page-title">{account.name}</h1>
            </div>
            <div className="text-end">
              <span className="eyebrow d-block">Balance</span>
              <span className="num fs-2 fw-semibold" data-testid="account-balance">
                {money(account.balanceMinor, account.currency)}
              </span>
            </div>
          </header>
        </>
      ) : (
        <header>
          <h1 className="page-title">Transactions</h1>
          <p className="text-secondary m-0">Everything you recorded, newest first.</p>
        </header>
      )}

      <div className="d-flex flex-wrap gap-4 align-items-start">
        <section
          className="surface flex-grow-1"
          style={{ flexBasis: 520, minWidth: 0 }}
          aria-labelledby="tx-title"
        >
          <div className="d-flex flex-column gap-3 px-4 pt-3 pb-3">
            <h2 id="tx-title" className="h6 fw-bolder m-0">
              Transactions
            </h2>
            <div className="d-flex flex-wrap align-items-end gap-3">
              <AccountFilter accounts={accounts} accountId={account?.id} />
              <MonthPicker month={month} />
            </div>
          </div>
          <div className="overflow-auto">
            <table className="table ft-table m-0" style={{ minWidth: account ? 520 : 600 }}>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Category</th>
                  <th scope="col">Description</th>
                  {account ? null : <th scope="col">Account</th>}
                  <th scope="col" className="text-end">
                    Amount
                  </th>
                  {account ? (
                    <th scope="col" className="text-end">
                      Balance
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => {
                  const currency = accountById.get(t.accountId)?.currency ?? 'USD';
                  return (
                    <tr key={t.id}>
                      <td className="num text-secondary text-nowrap">{formatDate(t.occurredOn)}</td>
                      <td>
                        <span className={`pill pill-${t.type}`}>{t.category}</span>
                      </td>
                      <td className="text-secondary">{t.description ?? '—'}</td>
                      {account ? null : <td>{accountById.get(t.accountId)?.name}</td>}
                      <td
                        className={`num text-end fw-semibold ${t.type === 'income' ? 'text-income' : 'text-expense'}`}
                      >
                        {txAmount(t.amountMinor, currency, t.type)}
                      </td>
                      {account ? (
                        <td className="num text-end">
                          {money(t.runningBalanceMinor ?? 0, currency)}
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="px-4 py-3 m-0 small text-secondary">
            {transactions.length} transaction{transactions.length === 1 ? '' : 's'} in{' '}
            {formatMonth(month)}
            {account ? ' · Balance is the running balance after each transaction.' : ''}
          </p>
        </section>
        <div className="flex-grow-1" style={{ flexBasis: 300, maxWidth: 420 }}>
          <AddTransactionForm
            key={account?.id ?? 'all'}
            accounts={accounts}
            defaultAccountId={account?.id}
          />
        </div>
      </div>
    </main>
  );
}
