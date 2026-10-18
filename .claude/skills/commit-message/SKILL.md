---
name: commit-message
description: Rules for writing commit messages and deciding commit granularity in this repo. Use before every git commit.
---

# Commit messages

## Format

```
<type>: <imperative summary, max 72 chars, no trailing period>

<optional body: what and why, wrapped at 72 chars>

<attribution trailer when an agent made the commit>
```

## Types

| Type      | Use for                                                         |
| --------- | --------------------------------------------------------------- |
| `feat:`   | New user-facing capability: endpoint, MCP tool, page, component |
| `bug:`    | Fix for incorrect behaviour (including review / security fixes) |
| `chores:` | Tooling, config, infra, docs, dependencies, refactors           |

Tests are committed **together with** the code they cover, under the same type.

## Granularity: one commit per deliverable

- One API resource (routes + repository + tests) → one commit
- One MCP tool group → one commit
- One frontend page → one commit
- One shared component / schema module → one commit
- Never mix unrelated deliverables; never commit a failing test suite.

## Examples

```
feat: add accounts API with per-user scoping
feat: add transactions page with month filter
bug: prevent cross-user access to transactions by id
chores: configure postgres service in docker compose
```

## Rules

- Run `make lint typecheck` and the relevant tests before committing.
- Agents never push and never bypass git hooks; the owner pushes and opens PRs.
