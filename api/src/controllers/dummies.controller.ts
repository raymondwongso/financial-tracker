import type { FastifyInstance } from "fastify";
import type { GetDummyService } from "../services/get-dummy.service.js";
import type { ListDummiesService } from "../services/list-dummies.service.js";

interface Deps {
  listDummies: ListDummiesService;
  getDummy: GetDummyService;
}

export function dummiesController({ listDummies, getDummy }: Deps) {
  return async (app: FastifyInstance) => {
    app.get("/dummies", async () => listDummies.execute());

    app.get<{ Params: { id: number } }>(
      "/dummies/:id",
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
        const dummy = await getDummy.execute(request.params.id);
        if (!dummy) return reply.code(404).send({ error: "not found" });
        return dummy;
      },
    );
  };
}
