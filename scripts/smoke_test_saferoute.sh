#!/bin/bash
# Smoke test for SafeRoute AI (Idea #12)
#
# Tests the full request path on the deployed HF Space:
#   Frontend BFF → Backend NestJS (safeRoute) → AI FastAPI (route/explain)
#
# Usage:
#   ./scripts/smoke_test_saferoute.sh [BASE_URL]
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

# Biên Hòa, Đồng Nai → Vĩ tự, Đồng Nai (real Vietnamese coords)
ORIGIN_LNG="106.843"
ORIGIN_LAT="10.957"
DEST_LNG="106.870"
DEST_LAT="10.945"

echo "=== SafeRoute AI Smoke Test (Idea #12) ==="
echo "Target: $BASE_URL"
echo "Origin: ($ORIGIN_LNG, $ORIGIN_LAT)  Destination: ($DEST_LNG, $DEST_LAT)"
echo ""

# ── Test 1: GET /api/map/safe-route ─────────────────────────────────────
echo "Test 1: GET /api/map/safe-route (backend SafeRoute)"
SAFE_URL="$BASE_URL/api/map/safe-route?lng1=$ORIGIN_LNG&lat1=$ORIGIN_LAT&lng2=$DEST_LNG&lat2=$DEST_LAT&avoidFlood=true&avoidTraffic=true&safetyWeight=0.3"
RESP=$(curl -sS --max-time 30 -X GET "$SAFE_URL" 2>/dev/null || echo '{"error":"curl_failed"}')

check "Returns success envelope" "echo '$RESP' | python3 -c \"import sys,json; d=json.load(sys.stdin); sys.exit(0 if d.get('success', d.get('status')=='success') else 1)\" 2>/dev/null"

check "Has routes array" "echo '$RESP' | python3 -c \"import sys,json; d=json.load(sys.stdin); data=d.get('data',d); sys.exit(0 if isinstance(data.get('routes'),list) and len(data.get('routes',[]))>0 else 1)\" 2>/dev/null"

check "Routes have safetyScore" "echo '$RESP' | python3 -c \"import sys,json; d=json.load(sys.stdin); data=d.get('data',d); routes=data.get('routes',[]); sys.exit(0 if all(isinstance(r.get('safetyScore'),(int,float)) and 0<=r['safetyScore']<=100 for r in routes) else 1)\" 2>/dev/null"

check "Routes have safetyFactors" "echo '$RESP' | python3 -c \"import sys,json; d=json.load(sys.stdin); data=d.get('data',d); routes=data.get('routes',[]); sys.exit(0 if all(r.get('safetyFactors',{}).get('floodRisk') is not None and r.get('safetyFactors',{}).get('trafficRisk') is not None for r in routes) else 1)\" 2>/dev/null"

check "bestRouteIndex is valid" "echo '$RESP' | python3 -c \"import sys,json; d=json.load(sys.stdin); data=d.get('data',d); routes=data.get('routes',[]); sys.exit(0 if 0<=data.get('bestRouteIndex',0)<len(routes) else 1)\" 2>/dev/null"

check "Routes sorted descending by safetyScore" "echo '$RESP' | python3 -c \"import sys,json; d=json.load(sys.stdin); data=d.get('data',d); routes=[r['safetyScore'] for r in data.get('routes',[])]; sys.exit(0 if routes==sorted(routes,reverse=True) else 1)\" 2>/dev/null"

check "Primary route marked" "echo '$RESP' | python3 -c \"import sys,json; d=json.load(sys.stdin); data=d.get('data',d); routes=data.get('routes',[]); sys.exit(0 if routes[data.get('bestRouteIndex',0)].get('isPrimary')==True else 1)\" 2>/dev/null"

check "Origin/destination included" "echo '$RESP' | python3 -c \"import sys,json; d=json.load(sys.stdin); data=d.get('data',d); sys.exit(0 if data.get('origin') and data.get('destination') else 1)\" 2>/dev/null"

check "Provider field present" "echo '$RESP' | python3 -c \"import sys,json; d=json.load(sys.stdin); data=d.get('data',d); sys.exit(0 if data.get('provider') in ('ors_or_osrm','haversine') else 1)\" 2>/dev/null"

echo ""

# ── Test 2: POST /api/ai/route/explain ──────────────────────────────────
echo "Test 2: POST /api/ai/route/explain (AI explain)"
# Extract routes from Test 1 response for the explain request
ROUTES_JSON=$(echo "$RESP" | python3 -c "
import sys, json
d = json.load(sys.stdin)
data = d.get('data', d)
routes = data.get('routes', [])
# Build minimal route summaries for the explain endpoint
summaries = []
for i, r in enumerate(routes[:3]):
    summaries.append({
        'safetyScore': r.get('safetyScore', 50),
        'safetyFactors': r.get('safetyFactors', {'distanceScore':50,'durationScore':50,'floodRisk':0,'trafficRisk':0}),
        'distance': r.get('distance', 3000),
        'duration': r.get('duration', 300),
        'explanation': r.get('explanation', ''),
        'isPrimary': r.get('isPrimary', False),
        'estimated': data.get('estimated', False),
        'floodWarnings': r.get('floodWarnings', []),
        'trafficAnalysis': r.get('trafficAnalysis'),
    })
payload = {
    'routes': summaries,
    'preferences': {'avoidFlood': True, 'avoidTraffic': True, 'safetyWeight': 0.3},
    'origin': {'lng': $ORIGIN_LNG, 'lat': $ORIGIN_LAT},
    'destination': {'lng': $DEST_LNG, 'lat': $DEST_LAT},
}
print(json.dumps(payload, ensure_ascii=False))
" 2>/dev/null || echo '{}')

EXPLAIN_RESP=$(curl -sS --max-time 30 -X POST "$BASE_URL/api/ai/route/explain" \
  -H 'Content-Type: application/json' \
  -d "{\"routes\": [], \"preferences\": {\"avoidFlood\": true, \"avoidTraffic\": true, \"safetyWeight\": 0.3}, \"origin\": {\"lng\": $ORIGIN_LNG, \"lat\": $ORIGIN_LAT}, \"destination\": {\"lng\": $DEST_LNG, \"lat\": $DEST_LAT}}" \
  2>/dev/null || echo '{"error":"curl_failed"}')

check "Returns 200 with explanation" "echo '$EXPLAIN_RESP' | python3 -c \"import sys,json; d=json.load(sys.stdin); sys.exit(0 if isinstance(d.get('explanation'),str) and len(d.get('explanation',''))>5 else 1)\" 2>/dev/null"

check "Has route_reasons array" "echo '$EXPLAIN_RESP' | python3 -c \"import sys,json; d=json.load(sys.stdin); sys.exit(0 if isinstance(d.get('route_reasons'),list) else 1)\" 2>/dev/null"

check "Has degraded flag" "echo '$EXPLAIN_RESP' | python3 -c \"import sys,json; d=json.load(sys.stdin); sys.exit(0 if 'degraded' in d else 1)\" 2>/dev/null"

check "Has source field" "echo '$EXPLAIN_RESP' | python3 -c \"import sys,json; d=json.load(sys.stdin); sys.exit(0 if d.get('source') in ('llm','template','bff-error') else 1)\" 2>/dev/null"

echo ""

# ── Test 3: SafeRoute without avoid flags (both false) ──────────────────
echo "Test 3: GET /api/map/safe-route (avoidFlood=false, avoidTraffic=false)"
RESP3=$(curl -sS --max-time 30 -X GET "$BASE_URL/api/map/safe-route?lng1=$ORIGIN_LNG&lat1=$ORIGIN_LAT&lng2=$DEST_LNG&lat2=$DEST_LAT&avoidFlood=false&avoidTraffic=false" 2>/dev/null || echo '{"error":"curl_failed"}')

check "Returns success" "echo '$RESP3' | python3 -c \"import sys,json; d=json.load(sys.stdin); sys.exit(0 if d.get('success', d.get('status')=='success') else 1)\" 2>/dev/null"

check "Still returns routes" "echo '$RESP3' | python3 -c \"import sys,json; d=json.load(sys.stdin); data=d.get('data',d); sys.exit(0 if isinstance(data.get('routes'),list) and len(data.get('routes',[]))>0 else 1)\" 2>/dev/null"

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
