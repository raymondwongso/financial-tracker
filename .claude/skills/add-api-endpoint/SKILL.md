---
name: add-api-endpoint
description: Step-by-step recipe for adding or changing a Fastify REST endpoint in api/, including shared schemas, repository code and the required integration tests. Use whenever a task adds or modifies an API route.
---

# Add an API endpoint

1. **Schema first** — add or extend zod schemas in `shared/src/schemas/<resource>.ts` and export them from
   `shared/src/index.ts`. Request and response types are `z.infer` of those schemas; the web app reuses them.
2. **Data access** — add a repository function in `shared/src/db/repositories/<resource>.ts`.
   - First parameter is `db`, second is `userId`; every query filters by `userId`.
   - Schema change? Edit `shared/src/db/schema.ts`, then `pnpm --filter @ft/api db:generate` (new SQL file in
     `api/migration`). Never edit an existing migration.
3. **Route** — add the handler in `api/src/routes/<resource>.ts`:
   - declare `schema: { body | querystring | params, response }` with the shared zod schemas;
   - use `preHandler: app.authenticate` and read `request.user.sub` as the user id;
   - throw `notFound()` / `conflict()` from `api/src/errors.ts` instead of hand-written replies.
   - New resource file? Register it in `api/src/app.ts` with a prefix.
4. **Integration test** — add cases to `api/test/<resource>.test.ts` using the helpers in `api/test/helpers.ts`
   (`createTestApp`, `registerAndLogin`, `resetDb`). Cover at least:
   - happy path (status + response body shape),
   - validation error (400),
   - unauthenticated (401),
   - another user's resource (404).
5. **Verify** — `pnpm --filter @ft/api test`, `make lint typecheck`, then commit per the `commit-message` skill.
