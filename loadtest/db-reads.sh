#!/usr/bin/env bash
# Database reads per page view (D133): opens each page signed out, once
# with an empty cache and then 20 more times, and prints how many
# requests the stand-in Supabase got for each. Needs `npm run build:e2e`.
set -euo pipefail
cd "$(dirname "$0")/.."
PORT=3301
node e2e/mock-supabase/server.mts > /dev/null 2>&1 & MOCK=$!
SUPABASE_SERVICE_ROLE_KEY=e2e-secret-key AI_PROVIDERS=fake YOUTUBE_PROVIDER=fake \
  PAYMENTS_PROVIDER=fake npx next start --port $PORT > /dev/null 2>&1 & NEXT=$!
trap 'kill $NEXT $MOCK 2>/dev/null || true' EXIT
until curl -sf http://localhost:54329/health >/dev/null && curl -sf "http://localhost:$PORT/robots.txt" >/dev/null; do sleep 1; done
count() { curl -s "http://localhost:54329/__stats?reset=1" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const o=JSON.parse(s);console.log(Object.values(o).reduce((a,b)=>a+b,0))})'; }
for path in / /learn /explore /videos/sintel "/videos/p-5c3e7a91-8b2d-4f6a-9c1e-3d4f5a6b7c8d"; do
  count > /dev/null
  curl -s -o /dev/null "http://localhost:$PORT$path"
  first=$(count)
  for i in $(seq 20); do curl -s -o /dev/null "http://localhost:$PORT$path"; done
  rest=$(count)
  echo "$path: first view $first requests; next 20 views $rest in all"
done
