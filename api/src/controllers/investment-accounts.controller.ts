import type { FastifyInstance } from "fastify";
import type {
  CreateInvestmentAccountRequest,
  CreateInvestmentTransactionRequest,
  InvestmentListQuery,
  SetInvestmentPriceRequest,
} from "@financialtracker/shared";
import { authenticate } from "../lib/auth.js";
import type { CreateInvestmentAccountService } from "../services/create-investment-account.service.js";
import type { CreateInvestmentTransactionService } from "../services/create-investment-transaction.service.js";
import type { DeleteInvestmentAccountService } from "../services/delete-investment-account.service.js";
import type { DeleteInvestmentTransactionService } from "../services/delete-investment-transaction.service.js";
import type { GetInvestmentAccountService } from "../services/get-investment-account.service.js";
import type { ListInvestmentAccountsService } from "../services/list-investment-accounts.service.js";
import type { ListInvestmentPriceHistoryService } from "../services/list-investment-price-history.service.js";
import type { ListInvestmentTransactionsService } from "../services/list-investment-transactions.service.js";
import type { SetInvestmentPriceService } from "../services/set-investment-price.service.js";

interface Deps {
  listAccounts: Pick<ListInvestmentAccountsService, "execute">;
  getAccount: Pick<GetInvestmentAccountService, "execute">;
  createAccount: Pick<CreateInvestmentAccountService, "execute">;
  setPrice: Pick<SetInvestmentPriceService, "execute">;
  listPriceHistory: Pick<ListInvestmentPriceHistoryService, "execute">;
  listTransactions: Pick<ListInvestmentTransactionsService, "execute">;
  createTransaction: Pick<CreateInvestmentTransactionService, "execute">;
  deleteAccount: Pick<DeleteInvestmentAccountService, "execute">;
  deleteTransaction: Pick<DeleteInvestmentTransactionService, "execute">;
}

const idParams = {
  type: "object",
  required: ["id"],
  properties: { id: { type: "integer", minimum: 1 } },
};

export function investmentAccountsController(d: Deps) {
  return async (app: FastifyInstance) => {
    app.addHook("onRequest", authenticate);

    app.get<{ Querystring: InvestmentListQuery }>(
      "/investment-accounts",
      {
        schema: {
          querystring: {
            type: "object",
            properties: {
              sortBy: { type: "string", enum: ["name", "value", "gain"] },
              order: { type: "string", enum: ["asc", "desc"] },
            },
          },
        },
      },
      async (request) => d.listAccounts.execute(request.user.id, request.query),
    );

    app.post<{ Body: CreateInvestmentAccountRequest }>(
      "/investment-accounts",
      {
        schema: {
          body: {
            type: "object",
            required: ["name", "assetType"],
            properties: {
              name: { type: "string", maxLength: 100 },
              assetType: { type: "string", enum: ["stock", "gold"] },
              symbol: { type: "string", maxLength: 20 },
            },
          },
        },
      },
      async (request, reply) =>
        reply.code(201).send(await d.createAccount.execute(request.user.id, request.body)),
    );

    app.delete<{ Params: { id: number } }>(
      "/investment-accounts/:id",
      { schema: { params: idParams } },
      async (request, reply) => {
        await d.deleteAccount.execute(request.user.id, request.params.id);
        return reply.code(204).send();
      },
    );

    app.get<{ Params: { id: number } }>(
      "/investment-accounts/:id",
      { schema: { params: idParams } },
      async (request) => d.getAccount.execute(request.user.id, request.params.id),
    );

    app.put<{ Params: { id: number }; Body: SetInvestmentPriceRequest }>(
      "/investment-accounts/:id/price",
      {
        schema: {
          params: idParams,
          body: {
            type: "object",
            required: ["price"],
            properties: {
              price: { type: "number", exclusiveMinimum: 0, maximum: 9999999999999 },
              date: { type: "string", format: "date" },
            },
          },
        },
      },
      async (request) =>
        d.setPrice.execute(request.user.id, request.params.id, request.body.price, request.body.date),
    );

    app.get<{ Params: { id: number } }>(
      "/investment-accounts/:id/price-history",
      { schema: { params: idParams } },
      async (request) => d.listPriceHistory.execute(request.user.id, request.params.id),
    );

    app.get<{ Params: { id: number } }>(
      "/investment-accounts/:id/transactions",
      { schema: { params: idParams } },
      async (request) => d.listTransactions.execute(request.user.id, request.params.id),
    );

    app.post<{ Params: { id: number }; Body: CreateInvestmentTransactionRequest }>(
      "/investment-accounts/:id/transactions",
      {
        schema: {
          params: idParams,
          body: {
            type: "object",
            required: ["side", "tradedOn", "quantity", "unitPrice"],
            properties: {
              side: { type: "string", enum: ["buy", "sell"] },
              tradedOn: { type: "string", format: "date" },
              quantity: { type: "number", exclusiveMinimum: 0, maximum: 99999999999999 },
              unitPrice: { type: "number", exclusiveMinimum: 0, maximum: 9999999999999 },
              note: { type: "string", maxLength: 120 },
            },
          },
        },
      },
      async (request, reply) =>
        reply
          .code(201)
          .send(await d.createTransaction.execute(request.user.id, request.params.id, request.body)),
    );

    app.delete<{ Params: { id: number; txId: number } }>(
      "/investment-accounts/:id/transactions/:txId",
      {
        schema: {
          params: {
            type: "object",
            required: ["id", "txId"],
            properties: {
              id: { type: "integer", minimum: 1 },
              txId: { type: "integer", minimum: 1 },
            },
          },
        },
      },
      async (request, reply) => {
        await d.deleteTransaction.execute(request.user.id, request.params.id, request.params.txId);
        return reply.code(204).send();
      },
    );
  };
}
