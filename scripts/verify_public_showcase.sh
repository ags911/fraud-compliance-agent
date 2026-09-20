#!/usr/bin/env bash
# Validate a deployed public showcase without exposing secrets. Inputs are
# public URLs supplied by the release operator; this script performs no deploy.
set -euo pipefail

: "${SHOWCASE_WEB_URL:?Set SHOWCASE_WEB_URL to the deployed Static Web Apps URL.}"
: "${SHOWCASE_API_URL:?Set SHOWCASE_API_URL to the deployed Container Apps URL.}"

web_origin="${SHOWCASE_WEB_URL%/}"
api_url="${SHOWCASE_API_URL%/}"
foreign_origin="${SHOWCASE_FOREIGN_ORIGIN:-https://foreign-origin.invalid}"

curl --fail --silent --show-error --location "$web_origin" >/dev/null
curl --fail --silent --show-error --location "$api_url/health" >/dev/null

allowed_headers="$(curl --silent --show-error --fail --include --request OPTIONS \
  --header "Origin: $web_origin" \
  --header 'Access-Control-Request-Method: POST' \
  "$api_url/run")"
printf '%s' "$allowed_headers" | grep -Fiq "access-control-allow-origin: $web_origin" || {
  echo "Deployed API did not grant the configured showcase web origin." >&2
  exit 1
}

foreign_headers="$(curl --silent --show-error --include --request OPTIONS \
  --header "Origin: $foreign_origin" \
  --header 'Access-Control-Request-Method: POST' \
  "$api_url/run")"
if printf '%s' "$foreign_headers" | grep -Eiq '^access-control-allow-origin:'; then
  echo "Deployed API granted a foreign origin." >&2
  exit 1
fi

echo "Public showcase health and CORS checks passed."
