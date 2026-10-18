---
name: security-review
description: Security review checklist based on OWASP Top 10 (https://owasp.org/projects/top-ten) mapped to this stack (Fastify, Next.js, Postgres/Drizzle, MCP, LLM). Use when reviewing changes that touch auth, data access, input handling, secrets, or the chat/MCP flow.
---

# Security review

Review the diff (`git diff main...HEAD` or the files given) against each item. Report findings as
`file:line — severity (critical/high/medium/low) — issue — fix`. Say "no findings" per category when clean.

## A01 Broken Access Control (highest priority here)

- Every repository function filters by `userId`; no query on `accounts` / `transactions` without it.
- Route handlers take `userId` from the verified JWT (`request.user.sub`), never from body/query/params.
- Accessing another user's resource returns **404** (not 403, to avoid enumeration).
- MCP tools take `userId` from the verified internal token, never from tool arguments.

## A02 Security Misconfiguration

- `@fastify/helmet` enabled; cookies `httpOnly`, `sameSite=lax`, `secure` in production.
- No stack traces or internal errors leaked in responses; the error handler returns generic messages for 5xx.
- MCP server is not exposed publicly (internal network only) and requires the internal token.

## A03 Software Supply Chain Failures

- New dependencies are well-known and maintained; lockfile committed; avoid packages with install scripts.

## A04 Cryptographic Failures

- Passwords hashed with argon2 (`@node-rs/argon2`); never logged or returned.
- `JWT_SECRET` / `MCP_INTERNAL_SECRET` come from env, are ≥32 chars, and are validated at boot.

## A05 Injection

- All SQL goes through the Drizzle query builder or `sql` template tags — no string concatenation.
- All external input is validated with zod schemas from `@ft/shared` (body, query, params, MCP tool args).
- React renders text only (no `dangerouslySetInnerHTML`), including chat replies from the LLM.

## A06 Insecure Design

- Rate limiting on `/auth/*` and `/chat`. The chat tool loop has an iteration cap.
- LLM output is untrusted: tools validate inputs and enforce ownership regardless of what the model asks.

## A07 Authentication Failures

- Generic "invalid email or password" on login; password min length 8; JWT expiry set; logout clears the cookie.

## A08 Software or Data Integrity Failures

- Migrations are append-only (committed migration files are never edited).

## A09 Logging & Alerting Failures

- Pino redacts `password`, `authorization`, `cookie`, `set-cookie`. Auth failures are logged at `warn`.

## A10 Mishandling of Exceptional Conditions

- Async errors reach Fastify's error handler; DB errors don't crash the process; auth fails closed.

## LLM / MCP specific

- Prompt injection via transaction descriptions cannot escalate: every tool is scoped to the caller.
- `ANTHROPIC_API_KEY` lives only on the API server and is never sent to the browser.
