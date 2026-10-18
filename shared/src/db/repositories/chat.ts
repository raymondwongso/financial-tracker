import { and, asc, desc, eq, inArray, lt } from 'drizzle-orm';
import type {
  ChatCard,
  ChatCardKind,
  ChatCardsPage,
  ChatMessage,
  ChatMessagesPage,
  ChatRole,
} from '../../schemas/chat';
import type { Db } from '../client';
import { chatCards, chatMessages, type ChatCardRow, type ChatMessageRow } from '../schema';

export interface NewChatCard {
  kind: ChatCardKind;
  data: unknown;
}

export interface PageOptions {
  /** `nextCursor` from the previous page (a sequence number). */
  before?: string;
  limit: number;
}

function toCard(row: ChatCardRow): ChatCard {
  return {
    id: row.id,
    kind: row.kind,
    createdAt: row.createdAt.toISOString(),
    data: row.data,
  } as ChatCard;
}

function toMessage(row: ChatMessageRow, cards: ChatCard[]): ChatMessage {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    createdAt: row.createdAt.toISOString(),
    cards,
  };
}

/** Stores one exchange (user message, assistant reply, reply's cards) atomically. */
export async function saveChatTurn(
  db: Db,
  userId: string,
  turn: { userContent: string; assistantContent: string; cards: NewChatCard[] },
): Promise<{ userMessage: ChatMessage; assistantMessage: ChatMessage }> {
  return db.transaction(async (tx) => {
    const [userRow] = await tx
      .insert(chatMessages)
      .values({ userId, role: 'user', content: turn.userContent })
      .returning();
    const [assistantRow] = await tx
      .insert(chatMessages)
      .values({ userId, role: 'assistant', content: turn.assistantContent })
      .returning();
    const cardRows = turn.cards.length
      ? await tx
          .insert(chatCards)
          .values(
            turn.cards.map((c) => ({
              userId,
              messageId: assistantRow!.id,
              kind: c.kind,
              data: c.data,
            })),
          )
          .returning()
      : [];
    cardRows.sort((a, b) => a.seq - b.seq);
    return {
      userMessage: toMessage(userRow!, []),
      assistantMessage: toMessage(assistantRow!, cardRows.map(toCard)),
    };
  });
}

/** A page of messages, oldest first, ending just before `before` (newest page when omitted). */
export async function listChatMessages(
  db: Db,
  userId: string,
  { before, limit }: PageOptions,
): Promise<ChatMessagesPage> {
  const filters = [eq(chatMessages.userId, userId)];
  if (before) filters.push(lt(chatMessages.seq, Number(before)));
  const rows = await db
    .select()
    .from(chatMessages)
    .where(and(...filters))
    .orderBy(desc(chatMessages.seq))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit).reverse();
  const cardRows = page.length
    ? await db
        .select()
        .from(chatCards)
        .where(
          and(
            eq(chatCards.userId, userId),
            inArray(
              chatCards.messageId,
              page.map((m) => m.id),
            ),
          ),
        )
        .orderBy(asc(chatCards.seq))
    : [];

  const cardsByMessage = new Map<string, ChatCard[]>();
  for (const row of cardRows) {
    const list = cardsByMessage.get(row.messageId) ?? [];
    list.push(toCard(row));
    cardsByMessage.set(row.messageId, list);
  }
  return {
    messages: page.map((m) => toMessage(m, cardsByMessage.get(m.id) ?? [])),
    nextCursor: hasMore && page[0] ? String(page[0].seq) : null,
  };
}

/** The last `count` messages as plain text turns, oldest first; used as LLM context. */
export async function recentChatHistory(
  db: Db,
  userId: string,
  count: number,
): Promise<Array<{ role: ChatRole; content: string }>> {
  const rows = await db
    .select({ role: chatMessages.role, content: chatMessages.content })
    .from(chatMessages)
    .where(eq(chatMessages.userId, userId))
    .orderBy(desc(chatMessages.seq))
    .limit(count);
  return rows.reverse();
}

/** A page of cards for the side pane, newest first. */
export async function listChatCards(
  db: Db,
  userId: string,
  { before, limit }: PageOptions,
): Promise<ChatCardsPage> {
  const filters = [eq(chatCards.userId, userId)];
  if (before) filters.push(lt(chatCards.seq, Number(before)));
  const rows = await db
    .select()
    .from(chatCards)
    .where(and(...filters))
    .orderBy(desc(chatCards.seq))
    .limit(limit + 1);
  const page = rows.slice(0, limit);
  const last = page.at(-1);
  return {
    cards: page.map(toCard),
    nextCursor: rows.length > limit && last ? String(last.seq) : null,
  };
}
