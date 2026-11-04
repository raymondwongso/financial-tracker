import type { TransactionPage } from "@financialtracker/shared";
import { badRequest, notFound } from "../errors.js";
import { decodeCursor, encodeCursor } from "../lib/cursor.js";
import type { AccountRepository } from "../repositories/postgres/account.repository.js";
import type { TransactionRepository } from "../repositories/postgres/transaction.repository.js";

export interface ListTransactionsInput {
  userId: number;
  accountId: number;
  from: string | null;
  to: string | null;
  limit: number;
  cursor: string | null;
}

export class ListTransactionsService {
  constructor(
    private readonly accounts: Pick<AccountRepository, "findByIdForUser">,
    private readonly transactions: Pick<TransactionRepository, "list" | "count">,
  ) {}

  async execute(i: ListTransactionsInput): Promise<TransactionPage> {
    if (!(await this.accounts.findByIdForUser(i.accountId, i.userId))) {
      throw notFound("Account not found");
    }
    const cursor = i.cursor ? decodeCursor(i.cursor) : null;
    if (i.cursor && !cursor) throw badRequest("Invalid cursor");

    const [rows, total] = await Promise.all([
      this.transactions.list({ accountId: i.accountId, from: i.from, to: i.to, limit: i.limit, cursor }),
      this.transactions.count(i.accountId, i.from, i.to),
    ]);
    const items = rows.slice(0, i.limit);
    const last = items[items.length - 1];
    const nextCursor =
      rows.length > i.limit && last ? encodeCursor({ createdAt: last.createdAt, id: last.id }) : null;
    return { items, nextCursor, total };
  }
}
