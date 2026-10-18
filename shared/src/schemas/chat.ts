import { z } from 'zod';
import { accountSchema, accountTypeSchema } from './account';
import { monthlySummarySchema } from './summary';
import { accountStatementSchema, transactionTypeSchema } from './transaction';

// ---------------------------------------------------------------------------
// Card snapshots. MCP tools return these as `structuredContent`; the API stores them unchanged
// as chat cards, so a card always shows what was true when the action happened.
// ---------------------------------------------------------------------------

export const accountCreatedDataSchema = z.object({
  account: accountSchema.pick({ id: true, name: true, currency: true, balanceMinor: true }).extend({
    type: accountTypeSchema,
  }),
});

export const transactionRecordedDataSchema = z.object({
  transaction: z.object({
    id: z.uuid(),
    accountId: z.uuid(),
    accountName: z.string(),
    currency: z.string(),
    type: transactionTypeSchema,
    amountMinor: z.number().int(),
    category: z.string(),
    description: z.string().nullable(),
    occurredOn: z.string(),
  }),
});

export const transactionsListedDataSchema = accountStatementSchema;

export const monthlySummaryDataSchema = monthlySummarySchema;

export const accountsListedDataSchema = z.object({ accounts: z.array(accountSchema) });

/** Which MCP tool produces which card; tools not listed (list_accounts) produce no card. */
export const cardKindByTool = {
  create_account: 'account_created',
  create_transaction: 'transaction_recorded',
  list_transactions: 'transactions_listed',
  monthly_summary: 'monthly_summary',
} as const;

const cardBase = { id: z.uuid(), createdAt: z.string() };

export const chatCardSchema = z.discriminatedUnion('kind', [
  z.object({ ...cardBase, kind: z.literal('account_created'), data: accountCreatedDataSchema }),
  z.object({
    ...cardBase,
    kind: z.literal('transaction_recorded'),
    data: transactionRecordedDataSchema,
  }),
  z.object({
    ...cardBase,
    kind: z.literal('transactions_listed'),
    data: transactionsListedDataSchema,
  }),
  z.object({ ...cardBase, kind: z.literal('monthly_summary'), data: monthlySummaryDataSchema }),
]);

export const chatCardKinds = [
  'account_created',
  'transaction_recorded',
  'transactions_listed',
  'monthly_summary',
] as const;
export const chatCardKindSchema = z.enum(chatCardKinds);

// ---------------------------------------------------------------------------
// Messages and pagination
// ---------------------------------------------------------------------------

export const chatRoles = ['user', 'assistant'] as const;
export const chatRoleSchema = z.enum(chatRoles);

export const chatSendSchema = z.object({
  message: z.string().trim().min(1, 'Message is required').max(4000),
});

export const chatMessageSchema = z.object({
  id: z.uuid(),
  role: chatRoleSchema,
  content: z.string(),
  createdAt: z.string(),
  cards: z.array(chatCardSchema),
});

export const chatSendResponseSchema = z.object({
  userMessage: chatMessageSchema,
  assistantMessage: chatMessageSchema,
});

const pageQuery = (defaultLimit: number) =>
  z.object({
    /** Opaque cursor from a previous page's `nextCursor`. */
    before: z.string().regex(/^\d{1,18}$/, 'Invalid cursor').optional(),
    limit: z.coerce.number().int().min(1).max(100).default(defaultLimit),
  });

export const CHAT_PAGE_SIZE = 20;
export const CARD_PAGE_SIZE = 50;

export const chatMessagesQuerySchema = pageQuery(CHAT_PAGE_SIZE);
export const chatCardsQuerySchema = pageQuery(CARD_PAGE_SIZE);

export const chatMessagesPageSchema = z.object({
  /** Oldest first within the page; `nextCursor` loads the page of older messages. */
  messages: z.array(chatMessageSchema),
  nextCursor: z.string().nullable(),
});

export const chatCardsPageSchema = z.object({
  /** Newest first; `nextCursor` loads older cards. */
  cards: z.array(chatCardSchema),
  nextCursor: z.string().nullable(),
});

export type AccountCreatedData = z.infer<typeof accountCreatedDataSchema>;
export type TransactionRecordedData = z.infer<typeof transactionRecordedDataSchema>;
export type TransactionsListedData = z.infer<typeof transactionsListedDataSchema>;
export type MonthlySummaryData = z.infer<typeof monthlySummaryDataSchema>;
export type AccountsListedData = z.infer<typeof accountsListedDataSchema>;
export type ChatCard = z.infer<typeof chatCardSchema>;
export type ChatCardKind = z.infer<typeof chatCardKindSchema>;
export type ChatRole = z.infer<typeof chatRoleSchema>;
export type ChatSend = z.infer<typeof chatSendSchema>;
export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type ChatSendResponse = z.infer<typeof chatSendResponseSchema>;
export type ChatMessagesQuery = z.infer<typeof chatMessagesQuerySchema>;
export type ChatMessagesPage = z.infer<typeof chatMessagesPageSchema>;
export type ChatCardsPage = z.infer<typeof chatCardsPageSchema>;
