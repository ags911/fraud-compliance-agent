#!/usr/bin/env bash
# Run the browser against an owned local FastAPI process. This is intentionally
# separate from unit/browser mocks: it verifies the actual Phase 0 SSE boundary.
set -euo pipefail

api_port=8011
web_port=4174
api_origin="http://127.0.0.1:${api_port}"
web_origin="http://127.0.0.1:${web_port}"
api_log="$(mktemp /tmp/fca-mvp2-api.XXXXXX.log)"
api_pid=""

cleanup() {
  if [ -n "$api_pid" ]; then
    kill "$api_pid" 2>/dev/null || true
    wait "$api_pid" 2>/dev/null || true
  fi
  rm -f "$api_log"
}
trap cleanup EXIT

if [ ! -f apps/api/vendor/arbiris-sdk/pyproject.toml ]; then
  echo "MVP 2 local acceptance needs the vendored Arbiris SDK checkout." >&2
  exit 2
fi

(
  cd apps/api
  ALLOWED_ORIGINS="$web_origin" uv run --frozen --extra sdk uvicorn server.main:app \
    --host 127.0.0.1 --port "$api_port"
) >"$api_log" 2>&1 &
api_pid=$!

for attempt in $(seq 1 30); do
  if curl --fail --silent "$api_origin/health" >/dev/null; then
    break
  fi
  if [ "$attempt" = 30 ]; then
    cat "$api_log" >&2
    echo "Local FastAPI process did not become healthy." >&2
    exit 1
  fi
  sleep 1
done

VITE_API_BASE_URL="$api_origin" PLAYWRIGHT_PORT="$web_port" RUN_LOCAL_API_MATRIX=1 \
  npm --prefix apps/web run test:payments -- tests/real-preset-matrix.spec.ts
