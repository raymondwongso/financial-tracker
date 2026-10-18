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
RUN pnpm install --frozen-lockfile --filter @ft/mcp...
COPY shared shared
COPY mcp mcp
RUN pnpm --filter @ft/mcp build \
  && pnpm --filter @ft/mcp deploy --prod --legacy /out

FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /out ./
USER node
EXPOSE 4100
CMD ["node", "dist/server.js"]
