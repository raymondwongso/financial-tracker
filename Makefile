# Load .env (if present) and export every variable to recipes.
-include .env
export

DATABASE_URL ?= postgres://tracker:tracker@localhost:5432/financial_tracker
TEST_DATABASE_URL ?= postgres://tracker:tracker@localhost:5432/financial_tracker_test

.PHONY: install run-database stop-database migrate-database \
	run-api-dev run-mcp-dev run-web-dev build-api build-mcp build-web build run-api run-mcp run-web \
	up down logs lint typecheck test test-hooks test-integration test-e2e

## Setup -----------------------------------------------------------------------
install:
	@test -f .env || cp .env.example .env
	pnpm install

## Database --------------------------------------------------------------------
run-database:
	docker compose up -d --wait postgres

stop-database:
	docker compose stop postgres

migrate-database:
	pnpm --filter @ft/api run db:migrate $(DATABASE_URL)
	pnpm --filter @ft/api run db:migrate $(TEST_DATABASE_URL)

## Development (hot reload) ----------------------------------------------------
run-api-dev:
	pnpm --filter @ft/api dev

run-mcp-dev:
	pnpm --filter @ft/mcp dev

run-web-dev:
	pnpm --filter @ft/web dev

## Build & run production output -----------------------------------------------
build-api:
	pnpm --filter @ft/api build

build-mcp:
	pnpm --filter @ft/mcp build

build-web:
	pnpm --filter @ft/web build

build: build-api build-mcp build-web

run-api:
	pnpm --filter @ft/api start

run-mcp:
	pnpm --filter @ft/mcp start

run-web:
	pnpm --filter @ft/web start

## Full stack in docker --------------------------------------------------------
up:
	docker compose --profile app up -d --build --wait

down:
	docker compose --profile app down

logs:
	docker compose --profile app logs -f --tail=100

## Quality ---------------------------------------------------------------------
lint:
	pnpm lint

typecheck:
	pnpm typecheck

test-hooks:
	pnpm test:hooks

test-integration:
	pnpm test:integration

test-e2e:
	pnpm test:e2e

test: test-hooks test-integration test-e2e
	pnpm test:count
