#!/bin/bash
# Smoke test for Voice-to-Geo AI (Idea #16: voice search → STT → intent → GIS)
#
# Tests the STT endpoint and intent classification on the deployed HF Space:
#   Frontend BFF → Backend NestJS → ai-service FastAPI
#
# Usage:
#   ./scripts/smoke_test_voice_geo.sh [BASE_URL]
#   BASE_URL defaults to the public HF Space URL.
#
# The STT endpoint degrades gracefully (returns 200 with degraded=True) when
# OPENROUTER_API_KEY is not configured as an HF Spaces Secret. The intent
# classification always runs via regex baseline (no LLM needed).
#
# Exit codes: 0 = all checks passed, 1 = at least one check failed.
set -euo pipefail

BASE_URL="${1:-https://tancse2005-edumap.hf.space}"
PASS=0
FAIL=0

check() {
  local name="$1"
  local condition="$2"
  if eval "$condition"; then
    echo "  ✓ $name"
    PASS=$((PASS + 1))
  else
    echo "  ✗ $name"
    FAIL=$((FAIL + 1))
  fi
}

echo "=== Voice-to-Geo AI (Idea #16) Smoke Test ==="
echo "Target: $BASE_URL"
echo ""

# ── Test 1: POST /api/ai/speech/to-text (degraded path — no key on test) ──
echo "Test 1: ai-service POST /api/ai/speech/to-text (degraded path)"
RESP=$(curl -sS --max-time 30 -X POST "$BASE_URL/api/ai/speech/to-text" \
  -H 'Content-Type: application/json' \
  -d '{"audio_base64":"","audio_format":"wav","language":"vi"}' 2>/dev/null || echo '{"error":"curl_failed"}')

check "Always returns 200 (graceful degradation)" \
  "echo '$RESP' | python3 -c \"import sys,json; d=json.load(sys.stdin); sys.exit(0 if d.get('degraded')==True else 1)\" 2>/dev/null"

check "Response has valid SpeechToTextResponse schema" \
  "echo '$RESP' | python3 -c \"import sys,json; d=json.load(sys.stdin); sys.exit(0 if all(k in d for k in ['text','method','degraded']) else 1)\" 2>/dev/null"

echo ""

# ── Test 2: Intent classification via nl-search (geo_recommend) ──────────
echo "Test 2: Intent — geo_recommend (find query)"
FIND_Q='Tìm thư viện gần trường có wifi ở Biên Hòa'
ENCODED_FIND=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$FIND_Q'))")
RESP2=$(curl -sS --max-time 30 "$BASE_URL/api/map/nl-search?q=$ENCODED_FIND" 2>/dev/null || echo '{"error":"curl_failed"}')

check "Intent is geo_recommend for find-query" \
  "echo '$RESP2' | python3 -c \"import sys,json; d=json.load(sys.stdin); data=d.get('data',d); i=data.get('intent',{}); sys.exit(0 if i.get('intent')=='geo_recommend' else 1)\" 2>/dev/null"

echo ""

# ── Test 3: Intent classification (geo_query for info question) ──────────
echo "Test 3: Intent — geo_query (info question)"
QUERY_Q='Trường DNTU ở đâu?'
ENCODED_QUERY=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$QUERY_Q'))")
RESP3=$(curl -sS --max-time 30 "$BASE_URL/api/map/nl-search?q=$ENCODED_QUERY" 2>/dev/null || echo '{"error":"curl_failed"}')

check "Intent is geo_query for info-question" \
  "echo '$RESP3' | python3 -c \"import sys,json; d=json.load(sys.stdin); data=d.get('data',d); i=data.get('intent',{}); sys.exit(0 if i.get('intent')=='geo_query' else 1)\" 2>/dev/null"

echo ""

# ── Test 4: Intent classification (report_form) ──────────────────────────
echo "Test 4: Intent — report_form (issue report)"
REPORT_Q='Báo wifi hỏng ở trường DNTU'
ENCODED_REPORT=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$REPORT_Q'))")
RESP4=$(curl -sS --max-time 30 "$BASE_URL/api/map/nl-search?q=$ENCODED_REPORT" 2>/dev/null || echo '{"error":"curl_failed"}')

check "Intent is report_form for issue-report" \
  "echo '$RESP4' | python3 -c \"import sys,json; d=json.load(sys.stdin); data=d.get('data',d); i=data.get('intent',{}); sys.exit(0 if i.get('intent')=='report_form' else 1)\" 2>/dev/null"

echo ""

# ── Summary ──────────────────────────────────────────────────────────────
echo "=== Summary ==="
echo "  Passed: $PASS"
echo "  Failed: $FAIL"
if [ "$FAIL" -gt 0 ]; then
  echo "  RESULT: FAIL"
  exit 1
else
  echo "  RESULT: ALL PASSED"
  exit 0
fi
