# AGENT.md — rules for AI agents working in this repository

Personal financial tracker: accounts, transactions, monthly summaries and an AI chat that acts on the
user's data through our own MCP server. It is also a portfolio piece, so code quality and tests matter.

## Layout (pnpm workspaces)

| Package      | Path      | What                                                                                                |
| ------------ | --------- | --------------------------------------------------------------------------------------------------- |
| `@ft/shared` | `shared/` | zod schemas + types (browser-safe); `@ft/shared/db` = Drizzle schema + repositories (server-only)   |
| `@ft/api`    | `api/`    | Fastify REST API (:4000), auth, `/chat` (Anthropic SDK + MCP client), migrations in `api/migration` |
| `@ft/mcp`    | `mcp/`    | MCP server (:4100, Streamable HTTP) exposing finance tools                                          |
| `@ft/web`    | `web/`    | Next.js App Router + Bootstrap 5 (:3000); proxies `/api/*` to the API                               |

Data flow: browser → web → (`/api/*` rewrite) → api → Postgres. Chat: api → Claude (tool use) → MCP client
→ mcp → `@ft/shared/db` → Postgres. Every service exposes `/health` and `/metrics` and logs JSON via Pino.

Chat-first UX: after login users land on `/chat`. Each successful MCP tool call becomes a **card** (snapshot
stored in `chat_cards`, schema `chatCardSchema` in `shared/src/schemas/chat.ts`); cards open in the right
pane. History is persisted and paginated (20 messages per page).

## Design first

UI or behaviour changes are designed and **approved by the user before any code is written**: update the
claude.ai design canvas (and list the API/data changes it implies), wait for approval, then implement.
For Next.js 16 conventions read `web/AGENTS.md` and the docs in `web/node_modules/next/dist/docs/`.

## Commands

```
make install             # pnpm install
make run-database        # Postgres in docker (dev + test databases)
make migrate-database    # apply api/migration to dev and test DBs
make run-api-dev | run-mcp-dev | run-web-dev    # hot reload
make lint typecheck
make test-integration    # shared + mcp + api (Vitest, real Postgres)
make test-e2e            # Playwright (scripts/e2e.sh: test ports, fake LLM, runs in Docker)
make test                # everything + test-count ratchet
```

## Coding rules

- TypeScript strict everywhere; no `any`; `import type` for types.
- Validate every boundary with zod schemas from `@ft/shared` (HTTP body/query/params, MCP tool input, env).
- **Every DB query is scoped by `userId`.** Another user's resource → 404.
- Money: integer minor units in the DB and API (`amountMinor`); format only in the UI.
- Config only via `src/config.ts` (zod-parsed env) in each service; never read `process.env` elsewhere.
- Use the Pino logger, never `console.log` in app code; never log secrets, passwords or cookies.
- Keep files small and cohesive; follow the existing pattern of the package you are in.
- Schema changes: edit `shared/src/db/schema.ts`, then `pnpm --filter @ft/api db:generate`.
  Committed migrations are immutable (enforced by hook).

## Testing rules

- Every endpoint, MCP tool and page ships with an integration / e2e test in the same commit.
- Tests hit the real test database; the LLM is always the scripted `FakeLlm` in tests.
- **Never delete, skip (`.skip`/`.only`/`xit`) or reduce tests.** Fix the code. If a test is genuinely wrong,
  stop and ask the user. Enforced by `.claude/hooks/guard.mjs` and `scripts/check-test-count.mjs`.
- After adding tests: `pnpm test:count --update`.

## Git rules

- Branch: work on the current feature branch; never commit to `main` directly.
- One commit per deliverable, using the `commit-message` skill (`feat:` / `bug:` / `chores:`).
- Never push, force, reset --hard or bypass hooks; the user pushes and opens PRs.

## Safety (enforced by hooks in `.claude/settings.json`)

- `guard.mjs` blocks: sudo, `git push`, destructive git, `docker compose down -v`, volume deletion,
  `curl | sh`, `chmod 777`, DROP/TRUNCATE outside the test DB, deleting test files, reading/writing `.env`.
- `format.mjs` runs Prettier + ESLint on every edited file; fix reported lint errors immediately.
- Secrets live in `.env` (git-ignored); document new variables in `.env.example`.

## Skills and agents

| Skill              | When                                        |
| ------------------ | ------------------------------------------- |
| `add-api-endpoint` | adding/changing a REST route                |
| `add-mcp-tool`     | adding/changing an MCP tool                 |
| `integration-test` | running, writing or reporting tests         |
| `code-review`      | reviewing a diff (references per stack)     |
| `security-review`  | OWASP Top 10 review for auth/data/chat code |
| `commit-message`   | before every commit                         |

Agents in `.claude/agents/`: `api-engineer`, `web-engineer`, `test-runner` (read-only, reports results),
`code-reviewer` (read-only, applies both review skills).

## Definition of done

1. Code + tests written; `make lint typecheck` clean (the same checks GitHub Actions CI runs on every PR).
2. Relevant suites green (`make test-integration`, plus `make test-e2e` for UI changes); test count not lower than baseline. CI must stay green.
3. Committed with the right type; README / `.env.example` updated if behaviour or config changed.
