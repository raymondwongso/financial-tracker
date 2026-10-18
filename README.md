# Financial Tracker
Track financial expenses and incomes via NextJS web application, supported by Fastify API, Postgres and MCP server.

Usecases:

- Create account(s)
- Create transaction(s)
- List transactions per account
- Summarize monthly transactions

## API
Serves data for web application. Connets to local MCP server for LLM integration. Fetch data from Postgres.

Tech stack:
- Fastify
- Typescript
- Postgres

## Web
Visualize data for user to see.

Tech stack:
- NextJS
- Typescript
- Bootstrap 5

## Shared
Contains common types and interfaces for both API and web.

## Architecture
// TODO: defines architecture diagram between each components

## Tooling
- Node v24 (maintained using nvm)
- Vite
- TODO: complete this list with logging, prometheus & grafana setup, any frontend tooling for monitoring
