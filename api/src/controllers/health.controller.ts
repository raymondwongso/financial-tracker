import type { FastifyInstance } from "fastify";
import type { Config } from "../config.js";

export function healthController(config: Config) {
  return async (app: FastifyInstance) => {
    app.get("/health", async () => ({ status: "ok", version: config.version }));
  };
}
