import type { FastifyInstance } from "fastify";
import type { CreateTransactionRequest } from "@financialtracker/shared";
import { authenticate } from "../lib/auth.js";
import type { CreateTransactionService } from "../services/create-transaction.service.js";
import type { DeleteTransactionService } from "../services/delete-transaction.service.js";

interface Deps {
  createTransaction: Pick<CreateTransactionService, "execute">;
  deleteTransaction: Pick<DeleteTransactionService, "execute">;
}

export function transactionsController({ createTransaction, deleteTransaction }: Deps) {
  return async (app: FastifyInstance) => {
    app.addHook("onRequest", authenticate);

    app.post<{ Body: CreateTransactionRequest }>(
      "/transactions",
      {
        schema: {
          body: {
            type: "object",
            required: ["accountId", "categoryId", "type", "amount"],
            properties: {
              accountId: { type: "integer", minimum: 1 },
              categoryId: { type: "integer", minimum: 1 },
              type: { type: "string", enum: ["income", "expense"] },
              amount: { type: "integer", minimum: 1, maximum: 999999999999999 },
              description: { type: "string", maxLength: 120 },
              occurredAt: { type: "string", format: "date-time" },
            },
          },
        },
      },
      async (request, reply) =>
        reply.code(201).send(await createTransaction.execute(request.user.id, request.body)),
    );

    app.delete<{ Params: { id: number } }>(
      "/transactions/:id",
      {
        schema: {
          params: {
            type: "object",
            required: ["id"],
            properties: { id: { type: "integer", minimum: 1 } },
          },
        },
      },
      async (request, reply) => {
        await deleteTransaction.execute(request.user.id, request.params.id);
        return reply.code(204).send();
      },
    );
  };
}
