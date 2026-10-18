#!/usr/bin/env bash
# Runs the Playwright suite against a full local stack:
#   postgres (docker) + mcp + api (fake LLM) + web, on dedicated ports, using the test database.
# Playwright runs inside the official Docker image so no browser system libraries are needed on
# the host. Set E2E_LOCAL=1 to use a locally installed Playwright browser instead.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOGS="$ROOT/web/test-results/e2e-logs"
PLAYWRIGHT_IMAGE="mcr.microsoft.com/playwright:v1.64.1-noble"
TEST_DATABASE_URL="${TEST_DATABASE_URL:-postgres://tracker:tracker@localhost:5432/financial_tracker_test}"
API_PORT=4400 MCP_PORT=4500 WEB_PORT=3300
mkdir -p "$LOGS"

pids=()
cleanup() {
  for pid in "${pids[@]}"; do kill "$pid" 2>/dev/null || true; done
  wait 2>/dev/null || true
}
trap cleanup EXIT

wait_for() {
  local url=$1 name=$2
  for _ in $(seq 1 120); do
    if curl -fsS "$url" >/dev/null 2>&1; then return 0; fi
    sleep 1
  done
  echo "Timed out waiting for $name ($url); see $LOGS" >&2
  exit 1
}

cd "$ROOT"
docker compose up -d --wait postgres >/dev/null
pnpm --filter @ft/api run db:migrate "$TEST_DATABASE_URL" >/dev/null

export NODE_ENV=test LOG_LEVEL=warn DATABASE_URL="$TEST_DATABASE_URL" LLM_PROVIDER=fake \
  JWT_SECRET=e2e-jwt-secret-that-is-at-least-32-chars \
  MCP_INTERNAL_SECRET=e2e-mcp-secret-that-is-at-least-32-chars \
  AUTH_RATE_LIMIT=10000 CHAT_RATE_LIMIT=10000

MCP_PORT=$MCP_PORT pnpm --filter @ft/mcp exec tsx src/server.ts >"$LOGS/mcp.log" 2>&1 &
pids+=($!)
API_PORT=$API_PORT MCP_URL="http://localhost:$MCP_PORT/mcp" \
  pnpm --filter @ft/api exec tsx src/server.ts >"$LOGS/api.log" 2>&1 &
pids+=($!)
(cd web && API_INTERNAL_URL="http://localhost:$API_PORT" NEXT_DIST_DIR=.next-e2e \
  exec pnpm exec next dev --port $WEB_PORT) >"$LOGS/web.log" 2>&1 &
pids+=($!)

wait_for "http://localhost:$MCP_PORT/health" mcp
wait_for "http://localhost:$API_PORT/health" api
wait_for "http://localhost:$WEB_PORT/login" web
# Compile the app routes once so the first tests don't time out on cold dev compilation.
for path in /register /chat /dashboard /accounts /transactions; do
  curl -fsS -o /dev/null "http://localhost:$WEB_PORT$path" || true
done

export E2E_BASE_URL="http://localhost:$WEB_PORT"
if [[ "${E2E_LOCAL:-0}" == "1" ]]; then
  (cd web && pnpm exec playwright test "$@")
else
  docker run --rm --network host --ipc=host -u "$(id -u):$(id -g)" -e HOME=/tmp \
    -e E2E_BASE_URL -e CI=1 -v "$ROOT:/work" -w /work/web "$PLAYWRIGHT_IMAGE" \
    node node_modules/@playwright/test/cli.js test "$@"
fi
