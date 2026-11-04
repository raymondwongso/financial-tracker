export type TransactionType = "income" | "expense";

export interface ApiErrorBody {
  error: string;
}

export interface AuthUser {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
}

export interface RegisterRequest {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface Account {
  id: number;
  name: string;
  description: string;
  initialBalance: number;
  createdAt: string;
}

export interface AccountWithBalance extends Account {
  balance: number;
  lastTransactionAt: string | null;
}

export interface CreateAccountRequest {
  name: string;
  description?: string;
  initialBalance: number;
}

export interface Category {
  id: number;
  name: string;
}

export interface CreateCategoryRequest {
  name: string;
}

export interface Transaction {
  id: number;
  accountId: number;
  categoryId: number;
  categoryName: string;
  type: TransactionType;
  amount: number;
  description: string | null;
  createdAt: string;
}

export interface CreateTransactionRequest {
  accountId: number;
  categoryId: number;
  type: TransactionType;
  amount: number;
  description?: string;
  /** ISO-8601 instant for backdating. Omitted means now. Must not be in the future. */
  occurredAt?: string;
}

export interface TransactionPage {
  items: Transaction[];
  nextCursor: string | null;
  total: number;
}

export interface AccountTotals {
  accountId: number;
  accountName: string;
  income: number;
  expense: number;
}

export interface DashboardSummary {
  accounts: AccountTotals[];
}

export interface TotalAssets {
  total: number;
  accountsTotal: number;
  /** Market value of priced investment positions only. */
  investmentsTotal: number;
  /** Held positions with no price; excluded from investmentsTotal. */
  unpricedInvestmentCount: number;
}

export interface CategoryTotal {
  categoryId: number;
  categoryName: string;
  amount: number;
}

export interface AccountSummary {
  income: CategoryTotal[];
  expense: CategoryTotal[];
}

export type InvestmentAssetType = "stock" | "gold";
export type InvestmentUnit = "share" | "gram";
export type InvestmentSide = "buy" | "sell";

export interface InvestmentAccount {
  id: number;
  name: string;
  assetType: InvestmentAssetType;
  /** Ticker (e.g. "BBCA") or "GOLD". */
  symbol: string;
  unit: InvestmentUnit;
  /** Units currently held (shares / grams). */
  quantity: number;
  /** Cost of the units currently held, IDR. */
  totalCost: number;
  /** Moving-average buy price per unit, IDR. 0 when nothing is held. */
  avgCost: number;
  realizedGain: number;
  /** Date (YYYY-MM-DD) of the latest transaction; new ones cannot be earlier. */
  lastTradedOn: string | null;
  /** Manually entered market price per unit, IDR. */
  currentPrice: number | null;
  priceUpdatedAt: string | null;
  /** quantity * currentPrice; null until a price is entered. */
  marketValue: number | null;
  /** marketValue - totalCost; null until a price is entered. */
  unrealizedGain: number | null;
  createdAt: string;
}

export interface CreateInvestmentAccountRequest {
  name: string;
  assetType: InvestmentAssetType;
  /** Required for stocks (ticker). Ignored for gold. */
  symbol?: string;
}

export interface InvestmentTransaction {
  id: number;
  investmentAccountId: number;
  side: InvestmentSide;
  /** YYYY-MM-DD */
  tradedOn: string;
  quantity: number;
  unitPrice: number;
  note: string | null;
  createdAt: string;
}

export interface CreateInvestmentTransactionRequest {
  side: InvestmentSide;
  /** YYYY-MM-DD. Not in the future, not before the account's latest transaction. */
  tradedOn: string;
  quantity: number;
  unitPrice: number;
  note?: string;
}

export interface SetInvestmentPriceRequest {
  price: number;
  /** YYYY-MM-DD the price applies to. Defaults to today; not in the future. */
  date?: string;
}

/** One dated price of an investment account (one per day). */
export interface InvestmentPricePoint {
  /** YYYY-MM-DD */
  date: string;
  price: number;
}

export interface InvestmentPortfolioSummary {
  totalCost: number;
  totalValue: number | null;
  unrealizedGain: number | null;
}

export type InvestmentSortKey = "name" | "value" | "gain";
export type SortOrder = "asc" | "desc";

/** Query for GET /investment-accounts. With no sortBy the list is newest first. */
export interface InvestmentListQuery {
  sortBy?: InvestmentSortKey;
  /** Defaults to "asc" when sortBy is given. Ignored without sortBy. */
  order?: SortOrder;
}

export interface InvestmentAccountList {
  items: InvestmentAccount[];
  summary: InvestmentPortfolioSummary;
}
