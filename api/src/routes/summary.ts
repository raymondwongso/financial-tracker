import { monthlySummaryQuerySchema, monthlySummarySchema } from '@ft/shared';
import { monthlySummary } from '@ft/shared/db';
import type { App } from '../types';

export async function summaryRoutes(app: App): Promise<void> {
  app.addHook('onRequest', app.authenticate);

  app.get(
    '/monthly',
    { schema: { querystring: monthlySummaryQuerySchema, response: { 200: monthlySummarySchema } } },
    async (request) => monthlySummary(app.db, request.user.sub, request.query.month),
  );
}
