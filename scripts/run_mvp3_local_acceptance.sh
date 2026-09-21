#!/usr/bin/env bash
# Exercise the public-showcase browser against an owned SDK-free FastAPI process.
set -euo pipefail

api_port=8012
web_port=4175
api_origin="http://127.0.0.1:${api_port}"
web_origin="http://127.0.0.1:${web_port}"
api_log="$(mktemp /tmp/fca-mvp3-api.XXXXXX.log)"
api_pid=""

cleanup() {
  if [ -n "$api_pid" ]; then
    kill "$api_pid" 2>/dev/null || true
    wait "$api_pid" 2>/dev/null || true
  fi
  rm -f "$api_log"
}
trap cleanup EXIT

(
  cd apps/api
  ALLOWED_ORIGINS="$web_origin" uv run uvicorn server.main:app \
    --host 127.0.0.1 --port "$api_port"
) >"$api_log" 2>&1 &
api_pid=$!

for attempt in $(seq 1 30); do
  if curl --fail --silent "$api_origin/health" >/dev/null; then
    break
  fi
  if [ "$attempt" = 30 ]; then
    sed -n '1,200p' "$api_log" >&2
    echo "Local SDK-free FastAPI process did not become healthy." >&2
    exit 1
  fi
  sleep 1
done

VITE_API_BASE_URL="$api_origin" PLAYWRIGHT_PORT="$web_port" RUN_LOCAL_SHOWCASE_MATRIX=1 \
  npm --prefix apps/web run test:payments -- tests/real-showcase-matrix.spec.ts
