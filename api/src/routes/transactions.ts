import {
  createTransactionSchema,
  listTransactionsQuerySchema,
  transactionListSchema,
  transactionSchema,
} from '@ft/shared';
import { createTransaction, listTransactions } from '@ft/shared/db';
import { notFound } from '../errors';
import type { App } from '../types';

export async function transactionRoutes(app: App): Promise<void> {
  app.addHook('onRequest', app.authenticate);

  app.get(
    '/',
    {
      schema: {
        querystring: listTransactionsQuerySchema,
        response: { 200: transactionListSchema },
      },
    },
    async (request) => listTransactions(app.db, request.user.sub, request.query),
  );

  app.post(
    '/',
    { schema: { body: createTransactionSchema, response: { 201: transactionSchema } } },
    async (request, reply) => {
      const transaction = await createTransaction(app.db, request.user.sub, request.body);
      if (!transaction) throw notFound('Account');
      return reply.status(201).send(transaction);
    },
  );
}
