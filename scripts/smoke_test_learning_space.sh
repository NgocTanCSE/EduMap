#!/bin/bash
# Smoke test #18 — AI Learning Space Recommender (Idea #13)
#
# Tests the full request path on the deployed HF Space:
#   Frontend BFF → Backend NestJS → ai-service FastAPI → SQLite
#
# Usage:
#   ./scripts/smoke_test_learning_space.sh [BASE_URL]
#   BASE_URL defaults to the public HF Space URL.
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

echo "=== Learning Space Recommender — Smoke Test #18 ==="
echo "Target: $BASE_URL"
echo ""

# ── Test 1: BFF GET /api/learning-spaces/recommend ─────────────────────
echo "Test 1: BFF GET /api/learning-spaces/recommend (Backend scoring)"
RESP=$(curl -sS --max-time 20 -X GET "$BASE_URL/api/learning-spaces/recommend" \
  -G --data-urlencode "lat=21.0279" --data-urlencode "lng=105.8342" \
  --data-urlencode "radius=5000" --data-urlencode "has_wifi=true" \
  --data-urlencode "min_rating=0" --data-urlencode "quietness_min=1" \
  --data-urlencode "limit=10" 2>/dev/null || echo '{"error":"curl_failed"}')

check "Returns success envelope or data" "echo '$RESP' | python3 -c \"import sys,json; d=json.load(sys.stdin); sys.exit(0 if (d.get('success') or d.get('status')=='success' or 'spots' in d.get('data',d)) else 1)\" 2>/dev/null"

check "spots is a list" "echo '$RESP' | python3 -c \"import sys,json; d=json.load(sys.stdin); data=d.get('data',d); sys.exit(0 if isinstance(data.get('spots'),list) else 1)\" 2>/dev/null"

check "at least 1 spot returned" "echo '$RESP' | python3 -c \"import sys,json; d=json.load(sys.stdin); data=d.get('data',d); sys.exit(0 if len(data.get('spots',[]))>=1 else 1)\" 2>/dev/null"

check "spot has a score (0-100)" "echo '$RESP' | python3 -c \"import sys,json; d=json.load(sys.stdin); data=d.get('data',d); spots=data.get('spots',[]); sys.exit(0 if len(spots)>0 and isinstance(spots[0].get('score'),(int,float)) and 0<=spots[0]['score']<=100 else 1)\" 2>/dev/null"

check "spot has matching_criteria" "echo '$RESP' | python3 -c \"import sys,json; d=json.load(sys.stdin); data=d.get('data',d); spots=data.get('spots',[]); sys.exit(0 if len(spots)>0 and isinstance(spots[0].get('matching_criteria'),dict) else 1)\" 2>/dev/null"

check "spot has open_now field" "echo '$RESP' | python3 -c \"import sys,json; d=json.load(sys.stdin); data=d.get('data',d); spots=data.get('spots',[]); sys.exit(0 if len(spots)>0 and 'open_now' in spots[0] else 1)\" 2>/dev/null"

echo ""

# ── Test 2: AI service explain (direct) ─────────────────────────────────
echo "Test 2: AI service POST /api/ai/learning-space/explain (direct)"
SPOT_JSON='{"id":"spot-1","name":"Thư viện Quốc gia Việt Nam","type":"library","rating_avg":4.5,"quietness":5,"has_wifi":true,"distance_km":2.3,"open_now":true,"matching_criteria":{"distance":0.8,"rating":0.9,"quietness":1.0,"wifi":1.0}}'
RESP2=$(curl -sS --max-time 30 -X POST "$BASE_URL/api/ai/learning-space/explain" \
  -H 'Content-Type: application/json' \
  -d "{\"spot\": $SPOT_JSON, \"preferences\": {\"radius_km\": 5, \"min_rating\": 4}}" \
  2>/dev/null || echo '{"error":"curl_failed"}')

check "Returns 200 with explanation" "echo '$RESP2' | python3 -c \"import sys,json; d=json.load(sys.stdin); sys.exit(0 if isinstance(d.get('explanation'),str) and len(d.get('explanation',''))>=10 else 1)\" 2>/dev/null"

check "Has degraded field (bool)" "echo '$RESP2' | python3 -c \"import sys,json; d=json.load(sys.stdin); sys.exit(0 if 'degraded' in d and isinstance(d.get('degraded'),bool) else 1)\" 2>/dev/null"

check "Never 500 — graceful degrade" "echo '$RESP2' | python3 -c \"import sys,json; d=json.load(sys.stdin); sys.exit(0 if 'error' not in d or d.get('explanation') else 1)\" 2>/dev/null"

echo ""

# ── Test 3: BFF POST /api/learning-spaces/explain (full path) ───────────
echo "Test 3: BFF POST /api/learning-spaces/explain (full BFF → backend → AI)"
RESP3=$(curl -sS --max-time 30 -X POST "$BASE_URL/api/learning-spaces/explain" \
  -H 'Content-Type: application/json' \
  -d "{\"spot\": $SPOT_JSON, \"preferences\": {\"radius_km\": 5}}" \
  2>/dev/null || echo '{"error":"curl_failed"}')

check "Returns explanation string" "echo '$RESP3' | python3 -c \"import sys,json; d=json.load(sys.stdin); data=d.get('data',d); sys.exit(0 if isinstance(data.get('explanation'),str) and len(data.get('explanation',''))>=5 else 1)\" 2>/dev/null"

check "Has degraded flag" "echo '$RESP3' | python3 -c \"import sys,json; d=json.load(sys.stdin); data=d.get('data',d); sys.exit(0 if 'degraded' in data else 1)\" 2>/dev/null"

echo ""

# ── Test 4: Real data check (no fake rows) ─────────────────────────────
echo "Test 4: Real Vietnamese data only (no synthetic rows)"
RESP4=$(curl -sS --max-time 20 -X GET "$BASE_URL/api/learning-spaces/recommend" \
  -G --data-urlencode "lat=21.0" --data-urlencode "lng=105.8" \
  --data-urlencode "radius=50000" --data-urlencode "limit=10" 2>/dev/null || echo '{"error":"curl_failed"}')

check "Returned spots are real Vietnamese venues" "echo '$RESP4' | python3 -c \"
import sys,json
d=json.load(sys.stdin); data=d.get('data',d)
spots=data.get('spots',[])
names=[s['spot']['name'] for s in spots if 'spot' in s]
banned=['EduMap Foundation','EduMap Academy','Test Activity','Test Campaign','BBF Activity']
sys.exit(0 if len(spots)>=1 and all(b not in n for n in names for b in banned) else 1)
\" 2>/dev/null"

check "Each spot has address field (real provenance)" "echo '$RESP4' | python3 -c \"
import sys,json
d=json.load(sys.stdin); data=d.get('data',d)
spots=data.get('spots',[])
sys.exit(0 if len(spots)>=1 and all('address' in s.get('spot',{}) or s['spot'].get('address') is not None for s in spots) else 1)
\" 2>/dev/null"

echo ""

# ── Summary ─────────────────────────────────────────────────────────────
echo "=== Summary ==="
echo "  Passed: $PASS / $((PASS + FAIL))"
echo "  Failed: $FAIL"
if [ "$FAIL" -gt 0 ]; then
  echo "  RESULT: FAIL"
  exit 1
else
  echo "  RESULT: ALL PASSED"
  exit 0
fi
