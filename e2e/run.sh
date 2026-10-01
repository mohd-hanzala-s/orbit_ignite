#!/usr/bin/env bash
# Runs a Playwright script against a production build served with a fresh, throwaway database.
# Usage: e2e/run.sh e2e/learner.mjs
set -euo pipefail
cd "$(dirname "$0")/.."
SCRIPT="${1:-e2e/learner.mjs}"
PORT="${E2E_PORT:-4100}"
DATA="$(mktemp -d)"
[ -f dist/index.html ] || npm run build >/dev/null
DATA_DIR="$DATA" PORT="$PORT" node --import tsx server/index.ts >"$DATA/server.log" 2>&1 &
PID=$!
trap 'kill $PID 2>/dev/null || true; rm -rf "$DATA"' EXIT
for i in $(seq 1 40); do curl -sf "localhost:$PORT/api/health" >/dev/null && break; sleep 0.5; done
BASE="http://localhost:$PORT" node "$SCRIPT"
