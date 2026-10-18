import { accountListSchema, accountSchema, createAccountSchema, idParamsSchema } from '@ft/shared';
import { createAccount, getAccount, listAccounts } from '@ft/shared/db';
import { notFound } from '../errors';
import type { App } from '../types';

export async function accountRoutes(app: App): Promise<void> {
  app.addHook('onRequest', app.authenticate);

  app.get('/', { schema: { response: { 200: accountListSchema } } }, async (request) =>
    listAccounts(app.db, request.user.sub),
  );

  app.post(
    '/',
    { schema: { body: createAccountSchema, response: { 201: accountSchema } } },
    async (request, reply) => {
      const account = await createAccount(app.db, request.user.sub, request.body);
      return reply.status(201).send(account);
    },
  );

  app.get(
    '/:id',
    { schema: { params: idParamsSchema, response: { 200: accountSchema } } },
    async (request) => {
      const account = await getAccount(app.db, request.user.sub, request.params.id);
      if (!account) throw notFound('Account');
      return account;
    },
  );
}
