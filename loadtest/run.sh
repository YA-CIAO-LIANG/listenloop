#!/usr/bin/env bash
# Load test (D133): starts the stand-in Supabase and the E2E production
# build on port 3300 with fake providers, runs loadtest/browse.js for
# each number of virtual users given (default 100 500 1000), and keeps
# each summary in .local/loadtest/. Run `npm run build:e2e` first.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p .local/loadtest
PORT=3300
cleanup() {
  [[ -n "${NEXT_PID:-}" ]] && kill "$NEXT_PID" 2>/dev/null || true
  [[ -n "${MOCK_PID:-}" ]] && kill "$MOCK_PID" 2>/dev/null || true
}
trap cleanup EXIT
if ! curl -sf http://localhost:54329/health >/dev/null; then
  node e2e/mock-supabase/server.mts > .local/loadtest/mock.log 2>&1 &
  MOCK_PID=$!
fi
SUPABASE_SERVICE_ROLE_KEY=e2e-secret-key AI_PROVIDERS=fake AZURE_SPEECH_KEY= \
  AZURE_OPENAI_API_KEY= GEMINI_API_KEY= GOOGLE_CLOUD_API_KEY= \
  YOUTUBE_PROVIDER=fake YOUTUBE_API_KEY= PAYMENTS_PROVIDER=fake \
  npx next start --port "$PORT" > .local/loadtest/next.log 2>&1 &
NEXT_PID=$!
until curl -sf "http://localhost:$PORT/" >/dev/null; do sleep 1; done
for vus in "${@:-100 500 1000}"; do
  for v in $vus; do
    echo "== $v virtual users =="
    VUS=$v BASE_URL="http://localhost:$PORT" k6 run --quiet \
      --summary-export ".local/loadtest/summary-$v.json" loadtest/browse.js \
      2>&1 | tee ".local/loadtest/run-$v.txt" | tail -40
  done
done
