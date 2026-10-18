import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  date,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { accountTypes } from '../schemas/account';
import { transactionTypes } from '../schemas/transaction';

export const accountTypeEnum = pgEnum('account_type', accountTypes);
export const transactionTypeEnum = pgEnum('transaction_type', transactionTypes);

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    name: text('name').notNull(),
    passwordHash: text('password_hash').notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('users_email_key').on(t.email)],
);

export const accounts = pgTable(
  'accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    type: accountTypeEnum('type').notNull(),
    currency: text('currency').notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('accounts_user_id_name_key').on(t.userId, sql`lower(${t.name})`)],
);

export const transactions = pgTable(
  'transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Denormalised owner so every query can be scoped by user without a join.
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    type: transactionTypeEnum('type').notNull(),
    amountMinor: bigint('amount_minor', { mode: 'number' }).notNull(),
    category: text('category').notNull(),
    description: text('description'),
    occurredOn: date('occurred_on', { mode: 'string' }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index('transactions_user_id_occurred_on_idx').on(t.userId, t.occurredOn),
    index('transactions_account_id_idx').on(t.accountId),
    check('transactions_amount_positive', sql`${t.amountMinor} > 0`),
  ],
);

export type UserRow = typeof users.$inferSelect;
export type AccountRow = typeof accounts.$inferSelect;
export type TransactionRow = typeof transactions.$inferSelect;
