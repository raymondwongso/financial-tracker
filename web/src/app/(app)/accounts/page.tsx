import type { Account } from '@ft/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ACCOUNT_TYPE_LABELS, money } from '@/lib/format';
import { serverApi } from '@/lib/server-api';
import { NewAccountForm } from './new-account-form';

export const metadata: Metadata = { title: 'Accounts' };

export default async function AccountsPage() {
  const accounts = await serverApi<Account[]>('/accounts');
  return (
    <main className="p-4 p-lg-5 d-flex flex-column gap-4">
      <header>
        <h1 className="page-title">Accounts</h1>
        <p className="text-secondary m-0">
          Bank accounts, wallets and cards you track. Balances come from your transactions.
        </p>
      </header>
      <div className="d-flex flex-wrap gap-4 align-items-start">
        <section
          aria-label="Your accounts"
          className="flex-grow-1"
          style={{ flexBasis: 480, minWidth: 0 }}
        >
          {accounts.length === 0 ? (
            <div className="surface p-4 text-center" style={{ borderStyle: 'dashed' }}>
              <h2 className="h5 fw-bolder">No accounts yet</h2>
              <p className="text-secondary m-0">
                Create your first account to start recording income and expenses — or ask the{' '}
                <Link href="/chat">assistant</Link> to do it for you.
              </p>
            </div>
          ) : (
            <div
              className="d-grid gap-3"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}
            >
              {accounts.map((a) => (
                <Link
                  key={a.id}
                  href={`/transactions?accountId=${a.id}`}
                  className="surface p-3 d-flex flex-column gap-2 text-reset text-decoration-none"
                  data-testid="account-card"
                >
                  <span className="d-flex justify-content-between align-items-center">
                    <span className="pill">{ACCOUNT_TYPE_LABELS[a.type]}</span>
                    <span className="small fw-bold text-secondary">{a.currency}</span>
                  </span>
                  <span className="fs-5 fw-bolder">{a.name}</span>
                  <span className="d-flex flex-column">
                    <span className="small text-secondary fw-semibold">Balance</span>
                    <span
                      className={`num fs-4 fw-semibold${a.balanceMinor < 0 ? ' text-expense' : ''}`}
                    >
                      {money(a.balanceMinor, a.currency)}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>
        <div className="flex-grow-1" style={{ flexBasis: 300, maxWidth: 420 }}>
          <NewAccountForm />
        </div>
      </div>
    </main>
  );
}
