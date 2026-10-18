# Drizzle / Postgres review reference

- Schema lives in `shared/src/db/schema.ts`; migrations are generated with `pnpm --filter @ft/api db:generate`
  into `api/migration`.
- Never edit a committed migration; add a new one.
- Every repository function takes `userId` and filters by it (joining through `accounts.user_id` where needed).
- Money is stored as `bigint` minor units (`mode: 'number'`); never floats.
- Add indexes for new filter / sort columns; use a transaction for multi-statement writes.
- No raw string SQL; use the query builder or the `sql` tagged template.
