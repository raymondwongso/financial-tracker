# financial-tracker

A personal finance tracker: manage cash accounts, record income and expenses by category, track investment holdings (stocks, funds and more) with cost basis and gains, and see everything on a dashboard. Amounts are in IDR.

## Features

- Email/password accounts with cookie-based sessions
- Cash accounts with running balances and transaction history (cursor-paginated, date-range filters)
- Income/expense transactions with per-user categories
- Investment accounts: buy/sell trades, average cost, realized and unrealized gain, price history
- Dashboard with per-account and per-category summaries and total assets

## Quick start

Requirements: Node.js 24+, pnpm, Docker with Compose v2, make.

```bash
make api-dev   # terminal 1: Postgres + migrations + API on http://localhost:3000
make web-dev   # terminal 2: web on http://localhost:3001
```

Running the API in Docker instead (`make api-docker-up`) requires a secret of 32+ characters:

```bash
JWT_SECRET="$(openssl rand -hex 32)" make api-docker-up
```

A monorepo with three parts:

- `api/` – the API service. Owns the data and exposes HTTP endpoints.
- `web/` – the web frontend. Calls the APIs provided by `api/`.
- `shared/` – types and interfaces shared by both `api/` and `web/`. (`@financialtracker/shared`, built with `make shared-build`)

Common commands are wrapped in the root `Makefile`, so you never need to `cd` into a sub-project. Run `make help` to list them.

## API (`api/`)

### Prerequisites

- Node.js 24+ and pnpm (workspace: `shared/`, `api/`, `web/`)
- Docker with Docker Compose v2 (runs Postgres, or the whole stack)
- make

### Environment configuration

```bash
cp api/.env.example api/.env
```

Edit `api/.env` as needed; `.env.example` is the source of truth for what is configurable. The file is optional for local development because the defaults match the Docker Compose database.

### Run locally

```bash
make api-dev
```

This installs dependencies, starts the Postgres container, applies pending migrations, and runs the API with hot reload on <http://localhost:3000>.

```bash
curl localhost:3000/api/health
```

Other targets: `make api-test`, `make api-build` (output in `api/dist`, run with `pnpm --filter financial-tracker-api start`), `make api-migrate`, `make api-docker-up` / `-down` / `-logs` / `-reset` (the full stack in Docker; `-reset` also wipes the database).

### Configuration

| Variable | Used by | Default | Notes |
| --- | --- | --- | --- |
| `PORT` | api | `3000` | |
| `LOG_LEVEL` | api | `info` | |
| `DATABASE_URL` | api | local Compose DB | |
| `JWT_SECRET` | api | dev-only value | **Required, 32+ chars when `NODE_ENV=production`** |
| `CORS_ORIGIN` | api | `http://localhost:3001` | Origin of the web app |
| `COOKIE_SECURE` | api | `true` in production | Set `false` only for plain-HTTP local use |
| `TRUST_PROXY` | api | `false` | Set `true` behind a reverse proxy so rate limiting sees real client IPs |
| `POSTGRES_PASSWORD` | Docker Compose | `postgres` | Override for anything beyond local use |
| `NEXT_PUBLIC_API_URL` | web | `http://localhost:3000` | |

### Endpoints

All routes are under `/api`; everything except `health`, `auth/register` and `auth/login` requires the session cookie.

| Area | Routes |
| --- | --- |
| Health | `GET /health` |
| Auth | `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` |
| Accounts | `GET/POST /accounts`, `GET/DELETE /accounts/:id`, `GET /accounts/:id/transactions`, `GET /accounts/:id/summary` |
| Transactions | `POST /transactions`, `DELETE /transactions/:id` |
| Categories | `GET/POST /categories` |
| Dashboard | `GET /dashboard/summary`, `GET /dashboard/total-assets` |
| Investments | `GET/POST /investment-accounts`, `GET/DELETE /investment-accounts/:id`, `PUT .../:id/price`, `GET .../:id/price-history`, `GET/POST .../:id/transactions`, `DELETE .../:id/transactions/:txId` |

### Database migrations

Migrations are plain SQL files in `api/db/migrations/`, applied in filename order and tracked in the `schema_migrations` table. To add a table or change the schema:

1. Create the next numbered file, e.g. `api/db/migrations/003_create_accounts.sql`, containing the SQL.
2. Run `make api-migrate` (`make api-dev` and `make api-docker-up` also apply it).

Never edit a migration that has already been applied; add a new one instead. Each file runs in a transaction.

### Project structure

```
api/
  db/migrations/            SQL migrations
  src/
    server.ts               entrypoint, graceful shutdown
    app.ts                  wiring: db pool -> repositories -> services -> controllers; routes under /api
    config.ts               typed config from environment
    migrate.ts              migration runner (migrations.ts has the pure helpers)
    controllers/            HTTP layer, one file per resource
    services/               business logic, one file per use case
    repositories/<dep>/     access to a dependency (e.g. postgres/), one file per resource
```

Request flow: controller -> service -> repository -> Postgres.

### Tech stack

TypeScript, Node.js, Fastify (pino logging), PostgreSQL through `pg` (raw SQL, no ORM), Docker Compose, `node:test` + `tsx` for tests.

## Web (`web/`)

Next.js (App Router) + TypeScript + Tailwind CSS + TanStack Query/Table. Needs Node.js 24+.

```bash
cp web/.env.example web/.env.local   # optional; NEXT_PUBLIC_API_URL defaults to http://localhost:3000
make web-dev                         # http://localhost:3001 (redirects to /dashboard)
```

Other targets: `make web-test`, `make web-build`, `make web-lint`.

Layout: `src/app` holds routes only (thin pages); feature code lives in `src/features/<name>`; shared UI in `src/components`; `src/lib/api-client.ts` is the only code that calls `api/`, over HTTP.

## Auth and test user

Login issues a JWT in an httpOnly cookie (`JWT_SECRET`, `CORS_ORIGIN`, `COOKIE_SECURE` in `api/.env`). To create a test user against a running API (local use only; do not create this user on a deployed instance):

```
curl -X POST localhost:3000/api/auth/register -H 'Content-Type: application/json' \
  -d '{"email":"demo@kas.app","firstName":"Demo","lastName":"User","password":"demo1234"}'
```

## Security

This project is not production-ready as shipped. See [SECURITY.md](SECURITY.md) for what is in place, known limitations (including the same-site deployment assumption for CSRF protection), and how to report a vulnerability.

## License

[MIT](LICENSE) © 2026 Raymond Wongso
