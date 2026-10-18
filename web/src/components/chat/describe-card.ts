import type { ChatCard } from '@ft/shared';
import type { ComponentType } from 'react';
import {
  ACCOUNT_TYPE_LABELS,
  formatDate,
  formatMonth,
  formatRange,
  money,
  txAmount,
} from '@/lib/format';
import { AccountIcon, ExpenseIcon, IncomeIcon, ListIcon, SummaryIcon } from '../icons';

export interface CardDescription {
  label: string;
  main: string;
  meta: string;
  amount?: string;
  amountClass?: string;
  tone: 'account' | 'expense' | 'income' | 'list' | 'summary';
  Icon: ComponentType<{ size?: number }>;
}

/** The compact one-line summary of a card used in the chat and in the pane list. */
export function describeCard(card: ChatCard): CardDescription {
  switch (card.kind) {
    case 'account_created': {
      const a = card.data.account;
      return {
        label: 'Account created',
        main: a.name,
        meta: `${ACCOUNT_TYPE_LABELS[a.type] ?? a.type} · ${a.currency}`,
        amount: money(a.balanceMinor, a.currency),
        tone: 'account',
        Icon: AccountIcon,
      };
    }
    case 'transaction_recorded': {
      const t = card.data.transaction;
      const income = t.type === 'income';
      return {
        label: income ? 'Income recorded' : 'Expense recorded',
        main: t.description || t.category,
        meta: `${t.accountName} · ${t.category} · ${formatDate(t.occurredOn)}`,
        amount: txAmount(t.amountMinor, t.currency, t.type),
        amountClass: income ? 'text-income' : 'text-expense',
        tone: income ? 'income' : 'expense',
        Icon: income ? IncomeIcon : ExpenseIcon,
      };
    }
    case 'transactions_listed':
      return {
        label: 'Transactions',
        main: card.data.account.name,
        meta: formatRange(card.data.from, card.data.to),
        tone: 'list',
        Icon: ListIcon,
      };
    case 'monthly_summary': {
      const names = [...new Set(card.data.byAccount.map((a) => a.accountName))];
      return {
        label: 'Monthly summary',
        main: formatMonth(card.data.month),
        meta: names.length ? names.join(', ') : 'No transactions',
        tone: 'summary',
        Icon: SummaryIcon,
      };
    }
  }
}
