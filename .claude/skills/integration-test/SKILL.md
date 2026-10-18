---
name: integration-test
description: How to run, write and report the integration (Vitest) and end-to-end (Playwright) test suites, and the rules that protect them from being weakened. Use when running tests, adding tests, or reporting test results.
---

# Integration tests

## Suites

| Suite  | Tool       | Location                  | Needs                                        |
| ------ | ---------- | ------------------------- | -------------------------------------------- |
| hooks  | Vitest     | `.claude/hooks/__tests__` | nothing                                      |
| shared | Vitest     | `shared/test`             | nothing                                      |
| mcp    | Vitest     | `mcp/test`                | Postgres (`make run-database`)               |
| api    | Vitest     | `api/test`                | Postgres; spins up an in-process MCP server  |
| web    | Playwright | `web/e2e`                 | Postgres; Playwright starts api, mcp and web |

The API and MCP suites use the **real** `financial_tracker_test` database (migrated in global setup,
truncated between tests). The LLM is always the scripted `FakeLlm` in tests — no API key, no network.

## Commands

```
make run-database        # once
make test-integration    # shared + mcp + api (Vitest)
make test-e2e            # Playwright (installs browsers on first run)
make test                # hooks + integration + e2e + test-count ratchet
```

## Writing tests

- Test behaviour through public interfaces: HTTP (`app.inject`), the MCP client, or the browser.
- Each test creates its own users / data via helpers; never depend on test order.
- Always include an ownership test (another user's data is invisible / 404) for new data access.
- Playwright: prefer `getByRole` / `getByLabel`; generate unique emails per test.

## Rules (enforced by hooks and `scripts/check-test-count.mjs`)

- Never delete, skip (`.skip`, `.only`, `xit`) or reduce the number of tests. Fix the code instead.
- A failing test that is genuinely wrong must be reported to the user before changing it.
- After adding tests run `pnpm test:count --update` so the baseline ratchets upward.

## Reporting results

Report concisely as a table — suite, passed / failed / total, duration — followed by each failure as
`test name — file:line — one-line cause`. Do not paste full logs.
