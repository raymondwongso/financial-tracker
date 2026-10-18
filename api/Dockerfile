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
RUN pnpm install --frozen-lockfile --filter @ft/api...
COPY shared shared
COPY api api
RUN pnpm --filter @ft/api build \
  && pnpm --filter @ft/api deploy --prod --legacy /out

FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /out ./
USER node
EXPOSE 4000
CMD ["node", "dist/server.js"]
