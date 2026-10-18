'use client';

import type {
  ChatCard,
  ChatCardsPage,
  ChatMessage,
  ChatMessagesPage,
  ChatSendResponse,
} from '@ft/shared';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/api-error';
import { SendIcon } from '../icons';
import { ActionCard } from './action-card';
import { CardDetail } from './card-detail';

interface Props {
  initialMessages: ChatMessagesPage;
  initialCards: ChatCardsPage;
  suggestions: string[];
}

export function ChatView({ initialMessages, initialCards, suggestions }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages.messages);
  const [cursor, setCursor] = useState(initialMessages.nextCursor);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [cards, setCards] = useState<ChatCard[]>(initialCards.cards);
  const [cardsCursor, setCardsCursor] = useState(initialCards.nextCursor);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string>();

  const logRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // How to adjust scroll after the next render: keep position (older page) or jump to bottom.
  const scrollIntent = useRef<{ kind: 'bottom' } | { kind: 'keep'; height: number; top: number }>({
    kind: 'bottom',
  });

  useLayoutEffect(() => {
    const log = logRef.current;
    if (!log) return;
    const intent = scrollIntent.current;
    log.scrollTop =
      intent.kind === 'bottom' ? log.scrollHeight : log.scrollHeight - intent.height + intent.top;
    scrollIntent.current = { kind: 'bottom' };
  }, [messages, pending]);

  const loadOlder = useCallback(async () => {
    if (!cursor || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const page = await api<ChatMessagesPage>(`/chat/messages?before=${cursor}`);
      const log = logRef.current;
      scrollIntent.current = {
        kind: 'keep',
        height: log?.scrollHeight ?? 0,
        top: log?.scrollTop ?? 0,
      };
      setMessages((prev) => [...page.messages, ...prev]);
      setCursor(page.nextCursor);
    } catch {
      setError('Could not load earlier messages.');
    } finally {
      setLoadingOlder(false);
    }
  }, [cursor, loadingOlder]);

  // Infinite scroll: load the previous page when the top of the conversation becomes visible.
  useEffect(() => {
    const top = topRef.current;
    if (!top || !cursor) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) void loadOlder();
      },
      { root: logRef.current, rootMargin: '200px 0px 0px 0px' },
    );
    observer.observe(top);
    return () => observer.disconnect();
  }, [cursor, loadOlder]);

  async function loadMoreCards() {
    if (!cardsCursor) return;
    const page = await api<ChatCardsPage>(`/chat/cards?before=${cardsCursor}`);
    setCards((prev) => [...prev, ...page.cards]);
    setCardsCursor(page.nextCursor);
  }

  async function send(text: string) {
    const message = text.trim();
    if (!message || pending) return;
    setPending(message);
    setDraft('');
    setError(undefined);
    try {
      const res = await api<ChatSendResponse>('/chat', { body: { message } });
      setMessages((prev) => [...prev, res.userMessage, res.assistantMessage]);
      // Pane is newest first.
      setCards((prev) => [...[...res.assistantMessage.cards].reverse(), ...prev]);
    } catch (err) {
      setDraft(message);
      setError(
        err instanceof ApiError
          ? err.status === 429
            ? 'You are sending messages too quickly. Please wait a moment.'
            : err.message
          : 'Could not reach the assistant. Check your connection and try again.',
      );
    } finally {
      setPending(null);
      inputRef.current?.focus();
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void send(draft);
  }

  const selected = useMemo(() => {
    if (!selectedId) return undefined;
    return (
      cards.find((c) => c.id === selectedId) ??
      messages.flatMap((m) => m.cards).find((c) => c.id === selectedId)
    );
  }, [selectedId, cards, messages]);

  return (
    <div className="chat-layout">
      <main className="chat-column" aria-label="Chat">
        <header className="px-4 pt-4 pb-3 border-bottom">
          <h1 className="h3 fw-bolder m-0">Chat</h1>
          <p className="text-secondary small m-0">
            Ask the assistant to create accounts, record transactions, list transactions or
            summarise a month.
          </p>
        </header>

        <div
          ref={logRef}
          className="chat-log"
          role="log"
          aria-live="polite"
          aria-label="Conversation"
        >
          <div ref={topRef} />
          {loadingOlder ? (
            <div className="d-flex justify-content-center" role="status">
              <span className="pill">Loading earlier messages…</span>
            </div>
          ) : null}
          {!cursor && messages.length > 0 ? (
            <div className="text-center small text-secondary">Start of conversation</div>
          ) : null}

          {messages.length === 0 && !pending ? (
            <div className="msg-bot">
              <div className="bubble">
                Hi! Tell me what happened with your money and I’ll keep track of it. Try one of
                these:
              </div>
              <div className="d-flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="btn btn-outline-secondary btn-sm rounded-pill"
                    onClick={() => void send(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {messages.map((m) =>
            m.role === 'user' ? (
              <div key={m.id} className="msg-user" data-testid="user-message">
                {m.content}
              </div>
            ) : (
              <div key={m.id} className="msg-bot" data-testid="assistant-message">
                <div className="bubble">{m.content}</div>
                {m.cards.length ? (
                  <div className="card-list">
                    {m.cards.map((c) => (
                      <ActionCard
                        key={c.id}
                        card={c}
                        selected={c.id === selectedId}
                        onSelect={setSelectedId}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            ),
          )}

          {pending ? (
            <>
              <div className="msg-user pending">{pending}</div>
              <div className="msg-bot" role="status">
                <div className="bubble text-secondary">Thinking…</div>
              </div>
            </>
          ) : null}
        </div>

        <form className="d-flex flex-column gap-2 px-4 pt-3 pb-4 border-top" onSubmit={onSubmit}>
          {error ? (
            <div className="alert alert-danger py-2 m-0 small fw-semibold" role="alert">
              {error}
            </div>
          ) : null}
          <div className="d-flex gap-2">
            <label htmlFor="chat-input" className="visually-hidden">
              Message
            </label>
            <input
              ref={inputRef}
              id="chat-input"
              className="form-control"
              placeholder="e.g. I spent 12.50 on lunch from Wallet"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={4000}
              autoComplete="off"
              autoFocus
            />
            <button
              type="submit"
              className="btn btn-primary d-inline-flex align-items-center gap-2"
              disabled={!draft.trim() || !!pending}
            >
              Send <SendIcon size={16} />
            </button>
          </div>
        </form>
      </main>

      <aside className="chat-pane" aria-label="Items in this chat">
        {selected ? (
          <CardDetail card={selected} onBack={() => setSelectedId(null)} />
        ) : (
          <>
            <div className="d-flex justify-content-between align-items-baseline">
              <h2 className="h5 fw-bolder m-0">In this chat</h2>
              <span className="small text-secondary fw-semibold">
                {cards.length} item{cards.length === 1 ? '' : 's'}
                {cardsCursor ? '+' : ''} · newest first
              </span>
            </div>
            {cards.length === 0 ? (
              <p className="small text-secondary m-0">
                Accounts, transactions and summaries the assistant creates will appear here.
              </p>
            ) : (
              <div className="card-list">
                {cards.map((c) => (
                  <ActionCard key={c.id} card={c} selected={false} onSelect={setSelectedId} />
                ))}
              </div>
            )}
            {cardsCursor ? (
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={() => void loadMoreCards()}
              >
                Load older items
              </button>
            ) : null}
          </>
        )}
      </aside>
    </div>
  );
}
