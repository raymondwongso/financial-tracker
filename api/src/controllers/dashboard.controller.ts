import type { FastifyInstance } from "fastify";
import { authenticate } from "../lib/auth.js";
import type { GetDashboardSummaryService } from "../services/get-dashboard-summary.service.js";
import type { GetTotalAssetsService } from "../services/get-total-assets.service.js";

interface Deps {
  getDashboardSummary: Pick<GetDashboardSummaryService, "execute">;
  getTotalAssets: Pick<GetTotalAssetsService, "execute">;
}

export function dashboardController({ getDashboardSummary, getTotalAssets }: Deps) {
  return async (app: FastifyInstance) => {
    app.addHook("onRequest", authenticate);

    app.get("/dashboard/total-assets", async (request) => getTotalAssets.execute(request.user.id));

    app.get<{ Querystring: { from?: string; to?: string } }>(
      "/dashboard/summary",
      {
        schema: {
          querystring: {
            type: "object",
            properties: {
              from: { type: "string", format: "date" },
              to: { type: "string", format: "date" },
            },
          },
        },
      },
      async (request) =>
        getDashboardSummary.execute(request.user.id, request.query.from ?? null, request.query.to ?? null),
    );
  };
}
