---
name: code-review
description: General code review guideline for this repo. Use when reviewing a diff or a set of files before committing or merging. Stack-specific checks live in references/.
---

# Code review

## How to review

1. Get the scope: `git diff main...HEAD --stat`, then read each changed file fully.
2. Load the matching references for the files touched:
   - any `*.ts` / `*.tsx` → `references/typescript.md`
   - `api/`, `mcp/` → `references/nodejs.md`, `references/fastify.md`
   - `shared/src/db/`, `api/migration/` → `references/drizzle.md`
   - `web/` → `references/nextjs.md`
3. Go through the general checklist below, then the references.
4. For auth, data-access or input-handling changes also apply the `security-review` skill.
5. Output findings ordered by severity: `file:line — [blocker|major|minor|nit] — problem — suggested fix`.
   End with a one-line verdict: **approve** or **changes requested**.

## General checklist

- **Correctness**: does it do what the task says? Edge cases (empty lists, month boundaries, zero amounts, unknown ids).
- **Tests**: every new endpoint / MCP tool / page has an integration or e2e test; tests assert behaviour,
  not implementation; no tests deleted, skipped or weakened.
- **Boundaries**: input validated with zod at every boundary; types come from `@ft/shared`, not redefined.
- **Data ownership**: every query is scoped by `userId`.
- **Errors**: no swallowed errors; clear user-facing messages; no internals leaked.
- **Readability**: small functions, descriptive names, no dead code, comments explain _why_.
- **Consistency**: follows existing patterns in the same package (plugin layout, repositories, page structure).
- **Observability**: meaningful log lines at the right level; no secrets logged.
- **Performance**: no N+1 queries; indexes exist for new filters.
