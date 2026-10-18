import type { ChatCard } from '@ft/shared';
import {
  ACCOUNT_TYPE_LABELS,
  formatDate,
  formatDateTime,
  formatMonth,
  formatRange,
  money,
  txAmount,
} from '@/lib/format';
import { ChevronLeftIcon, ClockIcon } from '../icons';
import { StatementTable } from '../statement-table';
import { SummaryView } from '../summary-view';

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="kv">
      <dt>{label}</dt>
      <dd className={mono ? 'num' : undefined}>{value}</dd>
    </div>
  );
}

/** Snapshot detail of a card, shown in the right-hand pane. */
export function CardDetail({ card, onBack }: { card: ChatCard; onBack: () => void }) {
  return (
    <div className="d-flex flex-column gap-3" aria-live="polite">
      <div className="d-flex justify-content-between align-items-center gap-2">
        <button
          type="button"
          className="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-1 fw-bold"
          onClick={onBack}
        >
          <ChevronLeftIcon size={16} />
          All items
        </button>
        <span className="pill d-inline-flex gap-1">
          <ClockIcon size={12} />
          Snapshot · {formatDateTime(card.createdAt)}
        </span>
      </div>
      <Body card={card} />
    </div>
  );
}

function Body({ card }: { card: ChatCard }) {
  switch (card.kind) {
    case 'account_created': {
      const a = card.data.account;
      return (
        <section className="d-flex flex-column gap-2">
          <span className="eyebrow">Account created</span>
          <h2 className="page-title">{a.name}</h2>
          <dl className="m-0">
            <Row label="Type" value={ACCOUNT_TYPE_LABELS[a.type] ?? a.type} />
            <Row label="Currency" value={a.currency} />
            <Row label="Opening balance" value={money(a.balanceMinor, a.currency)} mono />
            <Row label="Created" value={formatDateTime(card.createdAt)} />
          </dl>
        </section>
      );
    }
    case 'transaction_recorded': {
      const t = card.data.transaction;
      return (
        <section className="d-flex flex-column gap-2">
          <span className="eyebrow">
            {t.type === 'income' ? 'Income recorded' : 'Expense recorded'}
          </span>
          <span className={`big-amount ${t.type === 'income' ? 'text-income' : 'text-expense'}`}>
            {txAmount(t.amountMinor, t.currency, t.type)}
          </span>
          <dl className="m-0">
            <Row label="Description" value={t.description || '—'} />
            <Row label="Account" value={`${t.accountName} (${t.currency})`} />
            <Row label="Category" value={t.category} />
            <Row label="Date" value={formatDate(t.occurredOn)} />
            <Row label="Recorded" value={formatDateTime(card.createdAt)} />
          </dl>
        </section>
      );
    }
    case 'transactions_listed': {
      const s = card.data;
      return (
        <section className="d-flex flex-column gap-2">
          <span className="eyebrow">Transactions</span>
          <h2 className="h4 fw-bolder m-0">
            {s.account.name}{' '}
            <span className="fs-6 fw-semibold text-secondary">· {s.account.currency}</span>
          </h2>
          <p className="small text-secondary m-0">
            {formatRange(s.from, s.to)} · {s.transactions.length} transaction
            {s.transactions.length === 1 ? '' : 's'}
          </p>
          <StatementTable statement={s} />
        </section>
      );
    }
    case 'monthly_summary':
      return (
        <section className="d-flex flex-column gap-2">
          <span className="eyebrow">Monthly summary</span>
          <h2 className="h4 fw-bolder m-0">
            {formatMonth(card.data.month)}{' '}
            <span className="fs-6 fw-semibold text-secondary">· All accounts</span>
          </h2>
          <SummaryView summary={card.data} compact />
        </section>
      );
  }
}
