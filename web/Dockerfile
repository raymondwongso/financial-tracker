# syntax=docker/dockerfile:1
# Build context: repository root (see docker-compose.yml).
FROM node:24-alpine AS build
RUN npm install -g pnpm@12.6.0
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY shared/package.json shared/
COPY api/package.json api/
COPY mcp/package.json mcp/
COPY web/package.json web/
RUN pnpm install --frozen-lockfile --filter @ft/web...
COPY shared shared
COPY web web
# The /api/* rewrite target is fixed at build time.
ARG API_INTERNAL_URL=http://api:4000
ENV API_INTERNAL_URL=$API_INTERNAL_URL NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @ft/web build

FROM node:24-alpine
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build /repo/web/.next/standalone ./
COPY --from=build /repo/web/.next/static ./web/.next/static
USER node
EXPOSE 3000
CMD ["node", "web/server.js"]
