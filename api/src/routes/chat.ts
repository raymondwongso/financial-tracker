import Anthropic from '@anthropic-ai/sdk';
import { chatRequestSchema, chatResponseSchema } from '@ft/shared';
import type { ChatService } from '../chat/chat-service';
import { HttpError } from '../errors';
import type { App } from '../types';

export async function chatRoutes(
  app: App,
  opts: { chat: ChatService; rateLimit: number },
): Promise<void> {
  app.post(
    '/',
    {
      onRequest: app.authenticate,
      config: { rateLimit: { max: opts.rateLimit, timeWindow: '1 minute' } },
      schema: { body: chatRequestSchema, response: { 200: chatResponseSchema } },
    },
    async (request) => {
      try {
        return await opts.chat.reply(request.user.sub, request.body.messages, request.log);
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
}
