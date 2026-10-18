import Anthropic from '@anthropic-ai/sdk';
import {
  chatCardsPageSchema,
  chatCardsQuerySchema,
  chatMessagesPageSchema,
  chatMessagesQuerySchema,
  chatSendResponseSchema,
  chatSendSchema,
} from '@ft/shared';
import { listChatCards, listChatMessages } from '@ft/shared/db';
import type { ChatService } from '../chat/chat-service';
import { HttpError } from '../errors';
import type { App } from '../types';

export async function chatRoutes(
  app: App,
  opts: { chat: ChatService; rateLimit: number },
): Promise<void> {
  app.addHook('onRequest', app.authenticate);

  app.post(
    '/',
    {
      config: { rateLimit: { max: opts.rateLimit, timeWindow: '1 minute' } },
      schema: { body: chatSendSchema, response: { 200: chatSendResponseSchema } },
    },
    async (request) => {
      try {
        return await opts.chat.send(request.user.sub, request.body.message, request.log);
      } catch (error) {
        // Upstream failures (Claude API or MCP server) become a 502 with a friendly message.
        request.log.error({ err: error }, 'chat failed');
        const message =
          error instanceof Anthropic.RateLimitError
            ? 'The assistant is busy right now. Please try again in a moment.'
            : 'The assistant is unavailable right now. Please try again later.';
        throw new HttpError(502, 'AssistantUnavailable', message);
      }
    },
  );

  app.get(
    '/messages',
    { schema: { querystring: chatMessagesQuerySchema, response: { 200: chatMessagesPageSchema } } },
    async (request) => listChatMessages(app.db, request.user.sub, request.query),
  );

  app.get(
    '/cards',
    { schema: { querystring: chatCardsQuerySchema, response: { 200: chatCardsPageSchema } } },
    async (request) => listChatCards(app.db, request.user.sub, request.query),
  );
}
