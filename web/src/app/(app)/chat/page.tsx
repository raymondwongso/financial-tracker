import { currentMonth, type ChatCardsPage, type ChatMessagesPage } from '@ft/shared';
import type { Metadata } from 'next';
import { ChatView } from '@/components/chat/chat-view';
import { serverApi } from '@/lib/server-api';

export const metadata: Metadata = { title: 'Chat' };

export default async function ChatPage() {
  const [messages, cards] = await Promise.all([
    serverApi<ChatMessagesPage>('/chat/messages'),
    serverApi<ChatCardsPage>('/chat/cards'),
  ]);
  const suggestions = [
    'Create a cash account called Wallet in USD',
    'I spent 12.50 on Food from Wallet',
    `Summarise ${currentMonth()}`,
  ];
  return <ChatView initialMessages={messages} initialCards={cards} suggestions={suggestions} />;
}
