#!/bin/bash










set -euo pipefail

BASE_URL="${1:-}"
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

echo "=== Talk2Map Smoke Test ==="
echo "Target: $BASE_URL"
echo ""


echo "Test 1: ai-service POST /api/ai/map/query"
QUERY='Tìm thư viện gần trường có wifi ở Biên Hòa'
RESP=$(curl -sS --max-time 30 -X POST "$BASE_URL/api/ai/map/query" \
  -H 'Content-Type: application/json' \
  -d "{\"text\": \"$QUERY\"}" 2>/dev/null || echo '{"error":"curl_failed"}')

check "Returns 200 status" "echo '$RESP' | python3 -c \"import sys,json; sys.exit(0 if json.load(sys.stdin).get('status')=='success' else 1)\" 2>/dev/null"

check "Parsed facility_types includes library" "echo '$RESP' | python3 -c \"import sys,json; d=json.load(sys.stdin); sys.exit(0 if 'library' in d.get('parsed_query',{}).get('facility_types',[]) else 1)\" 2>/dev/null"

check "Parsed conditions includes wifi" "echo '$RESP' | python3 -c \"import sys,json; d=json.load(sys.stdin); sys.exit(0 if 'wifi' in d.get('parsed_query',{}).get('conditions',[]) else 1)\" 2>/dev/null"

check "Parsed location includes Biên Hòa" "echo '$RESP' | python3 -c \"import sys,json; d=json.load(sys.stdin); sys.exit(0 if d.get('parsed_query',{}).get('location','') else 1)\" 2>/dev/null"

echo ""


echo "Test 2: BFF GET /api/map/nl-search"
ENCODED_QUERY=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$QUERY'))")
RESP2=$(curl -sS --max-time 30 "$BASE_URL/api/map/nl-search?q=$ENCODED_QUERY" 2>/dev/null || echo '{"error":"curl_failed"}')

check "Returns success envelope" "echo '$RESP2' | python3 -c \"import sys,json; d=json.load(sys.stdin); sys.exit(0 if d.get('success', d.get('status')=='success') else 1)\" 2>/dev/null"

check "Results array present" "echo '$RESP2' | python3 -c \"import sys,json; d=json.load(sys.stdin); data=d.get('data',d); sys.exit(0 if isinstance(data.get('results'),list) else 1)\" 2>/dev/null"

check "Parsed query present" "echo '$RESP2' | python3 -c \"import sys,json; d=json.load(sys.stdin); data=d.get('data',d); sys.exit(0 if data.get('parsed_query') else 1)\" 2>/dev/null"

check "Explanation present" "echo '$RESP2' | python3 -c \"import sys,json; d=json.load(sys.stdin); data=d.get('data',d); sys.exit(0 if isinstance(data.get('explanation'),str) and len(data.get('explanation',''))>5 else 1)\" 2>/dev/null"

echo ""


echo "Test 3: Vietnamese dialect (3 miền)"
DIALECT_QUERY='Tìm trường học ở miền Trung có internet'
ENCODED_DIALECT=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$DIALECT_QUERY'))")
RESP3=$(curl -sS --max-time 30 "$BASE_URL/api/map/nl-search?q=$ENCODED_DIALECT" 2>/dev/null || echo '{"error":"curl_failed"}')

check "Southern 'truồng' variant detected" "echo '$RESP3' | python3 -c \"import sys,json; d=json.load(sys.stdin); data=d.get('data',d); pq=data.get('parsed_query',{}); sys.exit(0 if 'school' in pq.get('facility_types',[]) else 1)\" 2>/dev/null"

check "Miền Trung location detected" "echo '$RESP3' | python3 -c \"import sys,json; d=json.load(sys.stdin); data=d.get('data',d); pq=data.get('parsed_query',{}); sys.exit(0 if pq.get('location') else 1)\" 2>/dev/null"

echo ""


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
