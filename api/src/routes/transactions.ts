import {
  createTransactionSchema,
  listTransactionsQuerySchema,
  transactionListSchema,
  transactionSchema,
} from '@ft/shared';
import { monthBounds } from '@ft/shared';
import { accountStatement, createTransaction, listTransactions } from '@ft/shared/db';
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
    async (request) => {
      const { accountId, month, from, to } = request.query;
      if (!accountId) return listTransactions(app.db, request.user.sub, request.query);

      // A single account: include the running balance after each transaction (newest first).
      const range = month
        ? monthBounds(month)
        : { from: from ?? '0001-01-01', to: to ?? '9999-12-31' };
      const statement = await accountStatement(
        app.db,
        request.user.sub,
        accountId,
        range.from,
        range.to,
      );
      if (!statement) throw notFound('Account');
      return statement.transactions.reverse();
    },
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
