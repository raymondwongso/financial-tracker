'use client';

import type { Account } from '@ft/shared';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { shiftMonth } from '@/lib/format';
import { ChevronLeftIcon, ChevronRightIcon } from './icons';

function useSetParam() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (key: string, value: string | undefined) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`${pathname}?${next.toString()}`);
  };
}

/** Month selector with previous/next buttons; stored in the `month` query parameter. */
export function MonthPicker({ month }: { month: string }) {
  const setParam = useSetParam();
  return (
    <div className="d-flex align-items-center gap-2">
      <button
        type="button"
        className="btn btn-outline-secondary bg-white"
        aria-label="Previous month"
        onClick={() => setParam('month', shiftMonth(month, -1))}
      >
        <ChevronLeftIcon />
      </button>
      <label className="visually-hidden" htmlFor="month">
        Month
      </label>
      <input
        id="month"
        type="month"
        className="form-control fw-bold"
        style={{ width: 180 }}
        value={month}
        onChange={(e) => e.target.value && setParam('month', e.target.value)}
      />
      <button
        type="button"
        className="btn btn-outline-secondary bg-white"
        aria-label="Next month"
        onClick={() => setParam('month', shiftMonth(month, 1))}
      >
        <ChevronRightIcon />
      </button>
    </div>
  );
}

/** Account filter for the transactions page; stored in the `accountId` query parameter. */
export function AccountFilter({
  accounts,
  accountId,
}: {
  accounts: Account[];
  accountId?: string;
}) {
  const setParam = useSetParam();
  return (
    <div>
      <label htmlFor="account-filter" className="form-label small fw-bold mb-1">
        Account
      </label>
      <select
        id="account-filter"
        className="form-select"
        style={{ minWidth: 200 }}
        value={accountId ?? ''}
        onChange={(e) => setParam('accountId', e.target.value || undefined)}
      >
        <option value="">All accounts</option>
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name} ({a.currency})
          </option>
        ))}
      </select>
    </div>
  );
}
