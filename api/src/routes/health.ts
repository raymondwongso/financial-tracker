import { pingDb } from '@ft/shared/db';
import { z } from 'zod';
import type { App } from '../types';

export async function healthRoutes(app: App): Promise<void> {
  app.get(
    '/health',
    {
      logLevel: 'warn',
      schema: {
        response: {
          200: z.object({ status: z.literal('ok'), db: z.literal('up') }),
          503: z.object({ status: z.literal('degraded'), db: z.literal('down') }),
        },
      },
    },
    async (_request, reply) => {
      const dbUp = await pingDb(app.dbPool);
      return dbUp
        ? reply.send({ status: 'ok', db: 'up' })
        : reply.status(503).send({ status: 'degraded', db: 'down' });
    },
  );
}
