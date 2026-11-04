# AGENTS.md

Rules for AI agents and contributors. Read the README for setup and structure.

## Projects and how they relate

- `api/` serves data over HTTP. `web/` consumes it. `shared/` holds the types and interfaces both use.
- `web/` talks to `api/` only through HTTP; it must never import code from `api/`.
- Anything both sides need (request/response shapes, DTOs, enums) lives in `shared/`.
- When an API contract changes, update `shared/` first, then `api/`, then `web/`.
- `shared/` is the `@financialtracker/shared` pnpm workspace package (types only). Run `make shared-build` after changing it.

## Types

- Everything must be typed. `any` is forbidden in all projects.
- Do not use `as any` or `@ts-ignore` to get around the compiler. Use `unknown` and narrow it, generics, or shared types.
- TypeScript strict mode must stay on and `make api-build` must pass.

## Tests

- New behavior and bug fixes require tests.
- Never delete, skip, or weaken a test or assertion to make a change pass. Fix the code instead.
- Test coverage and the number of passing tests must never go down.

## Validating changes

- Before calling a task done, run `make api-test` and `make api-build` (and the equivalents for other projects).
- Everything must pass, and no previously passing test may regress. If something fails, say so; do not hide it.

## API conventions

- Layering: controller -> service -> repository. No SQL outside `repositories/`.
- One controller file per resource, one service file per use case, one repository file per resource.
- No ORM. Use raw SQL with parameterized queries.
- Schema changes only through a new numbered file in `api/db/migrations/`. Never edit an applied migration.

## More guidance

For project-specific skills and technology guidance, see `/.claude/skills`.
