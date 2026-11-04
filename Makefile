API     := api
WEB     := web
COMPOSE := docker compose -f $(API)/docker-compose.yml

.PHONY: help shared-build web-install web-dev web-test web-build web-lint api-install api-dev api-migrate api-test api-build \
        api-docker-up api-docker-down api-docker-logs api-docker-reset

help:
	@echo "make web-install       install workspace dependencies (pnpm)"
	@echo "make shared-build      build the @financialtracker/shared types package"
	@echo "make web-dev           run web (Next.js) on http://localhost:3001"
	@echo "make web-test          run web tests"
	@echo "make web-build         build web (next build)"
	@echo "make web-lint          lint web"
	@echo "make api-install       install api dependencies"
	@echo "make api-dev           install, start db, migrate, run api with hot reload"
	@echo "make api-migrate       apply pending db migrations (db must be running)"
	@echo "make api-test          run api tests"
	@echo "make api-build         compile api (tsc) into api/dist"
	@echo "make api-docker-up     build and start db + migrate + api in docker"
	@echo "make api-docker-down   stop docker services"
	@echo "make api-docker-logs   follow api logs"
	@echo "make api-docker-reset  stop services and wipe db volume"

web-install:
	pnpm install

shared-build: web-install
	pnpm --filter @financialtracker/shared run build

web-dev: shared-build
	pnpm --filter web run dev

web-test: shared-build
	pnpm --filter web test

web-build: shared-build
	pnpm --filter web run build

web-lint: shared-build
	pnpm --filter web run lint

api-install:
	pnpm install

api-dev: api-install shared-build
	$(COMPOSE) up -d --wait db
	pnpm --filter financial-tracker-api run migrate
	pnpm --filter financial-tracker-api run dev

api-migrate:
	pnpm --filter financial-tracker-api run migrate

api-test: api-install shared-build
	pnpm --filter financial-tracker-api test

api-build: api-install shared-build
	pnpm --filter financial-tracker-api run build

api-docker-up:
	$(COMPOSE) up --build -d

api-docker-down:
	$(COMPOSE) down

api-docker-logs:
	$(COMPOSE) logs -f api

api-docker-reset:
	$(COMPOSE) down -v
