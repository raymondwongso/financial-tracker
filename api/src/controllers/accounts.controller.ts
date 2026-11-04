import type { FastifyInstance } from "fastify";
import type { CreateAccountRequest } from "@financialtracker/shared";
import { authenticate } from "../lib/auth.js";
import type { CreateAccountService } from "../services/create-account.service.js";
import type { DeleteAccountService } from "../services/delete-account.service.js";
import type { GetAccountService } from "../services/get-account.service.js";
import type { GetAccountSummaryService } from "../services/get-account-summary.service.js";
import type { ListAccountsService } from "../services/list-accounts.service.js";
import type { ListTransactionsService } from "../services/list-transactions.service.js";

interface Deps {
  listAccounts: Pick<ListAccountsService, "execute">;
  getAccount: Pick<GetAccountService, "execute">;
  deleteAccount: Pick<DeleteAccountService, "execute">;
  createAccount: Pick<CreateAccountService, "execute">;
  listTransactions: Pick<ListTransactionsService, "execute">;
  getAccountSummary: Pick<GetAccountSummaryService, "execute">;
}

const idParams = {
  type: "object",
  required: ["id"],
  properties: { id: { type: "integer", minimum: 1 } },
};
const rangeProps = {
  from: { type: "string", format: "date" },
  to: { type: "string", format: "date" },
};

export function accountsController(d: Deps) {
  return async (app: FastifyInstance) => {
    app.addHook("onRequest", authenticate);

    app.get("/accounts", async (request) => d.listAccounts.execute(request.user.id));

    app.post<{ Body: CreateAccountRequest }>(
      "/accounts",
      {
        schema: {
          body: {
            type: "object",
            required: ["name", "initialBalance"],
            properties: {
              name: { type: "string", maxLength: 100 },
              description: { type: "string", maxLength: 500 },
              initialBalance: { type: "integer", minimum: 0, maximum: 999999999999999 },
            },
          },
        },
      },
      async (request, reply) =>
        reply.code(201).send(await d.createAccount.execute(request.user.id, request.body)),
    );

    app.get<{ Params: { id: number } }>(
      "/accounts/:id",
      { schema: { params: idParams } },
      async (request) => d.getAccount.execute(request.user.id, request.params.id),
    );

    app.delete<{ Params: { id: number } }>(
      "/accounts/:id",
      { schema: { params: idParams } },
      async (request, reply) => {
        await d.deleteAccount.execute(request.user.id, request.params.id);
        return reply.code(204).send();
      },
    );

    app.get<{
      Params: { id: number };
      Querystring: { from?: string; to?: string; limit?: number; cursor?: string };
    }>(
      "/accounts/:id/transactions",
      {
        schema: {
          params: idParams,
          querystring: {
            type: "object",
            properties: {
              ...rangeProps,
              limit: { type: "integer", minimum: 1, maximum: 100, default: 10 },
              cursor: { type: "string", maxLength: 300 },
            },
          },
        },
      },
      async (request) =>
        d.listTransactions.execute({
          userId: request.user.id,
          accountId: request.params.id,
          from: request.query.from ?? null,
          to: request.query.to ?? null,
          limit: request.query.limit ?? 10,
          cursor: request.query.cursor ?? null,
        }),
    );

    app.get<{ Params: { id: number }; Querystring: { from?: string; to?: string } }>(
      "/accounts/:id/summary",
      { schema: { params: idParams, querystring: { type: "object", properties: rangeProps } } },
      async (request) =>
        d.getAccountSummary.execute(
          request.user.id,
          request.params.id,
          request.query.from ?? null,
          request.query.to ?? null,
        ),
    );
  };
}
