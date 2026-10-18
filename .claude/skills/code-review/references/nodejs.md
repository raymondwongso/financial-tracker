# Node.js review reference

- Config is read once from env and validated with zod at startup (`src/config.ts`); fail fast on invalid config.
- No sync filesystem / crypto calls in request paths.
- Graceful shutdown: close Fastify, the DB pool and MCP clients on SIGINT/SIGTERM.
- Use the Fastify/Pino logger, never `console.log`.
- Long-lived resources (DB pools, MCP clients, LLM clients) are created once and injected, not per request.
- ESM only; Node 24 built-ins with the `node:` prefix.
