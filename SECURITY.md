# Security Policy

## Reporting a vulnerability

Please do **not** open a public issue for security problems. Use GitHub's
[private vulnerability reporting](../../security/advisories/new) on this repository, or email
raymondwongso.private@gmail.com. Include steps to reproduce and the affected version or commit.
Expect an acknowledgement within a few days.

## Scope and status

This is a personal project and has not been through a formal audit. It is suitable for local use and
self-hosting behind your own hardening; treat it as **not production-ready as shipped**.

## What is in place

- Parameterized SQL only; every query is scoped to the authenticated user.
- Passwords hashed with scrypt (random salt, constant-time comparison).
- JWT in an httpOnly, SameSite=Lax cookie (7-day expiry); `JWT_SECRET` must be 32+ characters in production.
- helmet, CORS pinned to a single origin, rate limiting on login and register, request schema validation.

## Known limitations

- **No server-side session revocation.** Logout clears the cookie; a stolen token stays valid until it expires (7 days).
- **CSRF protection relies on SameSite=Lax.** Deploy the web app and API on the same site (same registrable domain).
  Cross-site deployments need `SameSite=None` plus a CSRF token, which is not implemented.
- **Open registration**, and "email already registered" responses allow email enumeration (rate limited).
- **Password policy** is a minimum of 8 characters, with no breach-list check or MFA.
- **Rate limiting is per client IP.** Behind a reverse proxy set `TRUST_PROXY=true`, otherwise all clients share the proxy's IP.
- The Docker Compose file is for local development: default database password (override with `POSTGRES_PASSWORD`) and no TLS.
