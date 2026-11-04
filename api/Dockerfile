# Build context is the repo root (see docker-compose.yml): the api depends on ../shared.
FROM node:24-alpine AS build
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY shared/package.json shared/
COPY api/package.json api/
COPY web/package.json web/
RUN pnpm install --frozen-lockfile --filter financial-tracker-api...
COPY shared shared
COPY api/tsconfig.json api/
COPY api/src api/src
RUN pnpm --filter @financialtracker/shared run build && pnpm --filter financial-tracker-api run build

FROM node:24-alpine
RUN corepack enable
WORKDIR /app
ENV NODE_ENV=production
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY shared/package.json shared/
COPY api/package.json api/
COPY web/package.json web/
RUN pnpm install --frozen-lockfile --prod --filter financial-tracker-api...
COPY --from=build /app/shared/dist shared/dist
COPY --from=build /app/api/dist api/dist
COPY api/db/migrations api/db/migrations
WORKDIR /app/api
USER node
EXPOSE 3000
CMD ["node", "dist/server.js"]
