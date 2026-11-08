#!/usr/bin/env bash
# Smoke test nhanh sau khi deploy Render.
# Dùng:
#   ./scripts/smoke_render.sh https://edumap-api.onrender.com https://edumap-ai.onrender.com

set -uo pipefail

API="${1:-}"
AI="${2:-}"

if [ -z "$API" ] || [ -z "$AI" ]; then
    echo "Dùng: $0 <API_URL> <AI_URL>" >&2
    exit 1
fi

API="${API%/}"
AI="${AI%/}"

pass=0
fail=0

check() {
    local label="$1"
    local out="$2"
    local ok="$3"
    if [ "$ok" = "1" ]; then
        echo "  [OK]   $label"
        pass=$((pass + 1))
    else
        echo "  [FAIL] $label"
        echo "         ${out:0:300}"
        fail=$((fail + 1))
    fi
}

echo "API = $API"
echo "AI  = $AI"
echo
echo "Lưu ý: lần đầu có thể mất 30-60s vì free tier đang ngủ. Script chờ tối đa 90s."

wait_up() {
    local url="$1"
    for i in $(seq 1 18); do
        code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 12 "$url" || true)
        [ "$code" = "200" ] && return 0
        echo "  ... đang chờ ($i/18, HTTP $code)"
        sleep 5
    done
    return 1
}

echo
echo "1. Backend health"
if wait_up "$API/api/health"; then
    body=$(curl -s --max-time 20 "$API/api/health")
    check "/api/health 200" "$body" "1"
else
    check "/api/health 200" "không phản hồi sau 90s" "0"
fi

echo
echo "2. Dữ liệu từ Postgres"
body=$(curl -s --max-time 30 "$API/api/map/pois?limit=3")
if echo "$body" | grep -qE '"id"|"data"|"items"'; then
    n=$(echo "$body" | grep -o '"id"' | wc -l)
    echo "  [OK]   /api/map/pois trả $n bản ghi"
    pass=$((pass + 1))
else
    check "/api/map/pois có dữ liệu" "$body" "0"
fi

echo
echo "3. Định tuyến (OSRM public)"
body=$(curl -s --max-time 30 "$API/api/map/routing/route?lng1=106.6605&lat1=10.3163&lng2=106.8427&lat2=10.9574")
if echo "$body" | grep -qE '"geometry"|LineString|coordinates'; then
    echo "  [OK]   routing trả geometry"
    pass=$((pass + 1))
else
    check "routing có geometry" "$body" "0"
fi

echo
echo "4. AI service health"
if wait_up "$AI/health"; then
    body=$(curl -s --max-time 20 "$AI/health")
    check "/health 200" "$body" "1"
else
    check "/health 200" "không phản hồi sau 90s" "0"
fi

echo
echo "5. AI chat (không cần đăng nhập)"
body=$(curl -s --max-time 60 -X POST "$AI/api/ai/chat/" \
    -H "Content-Type: application/json" \
    -d '{"message":"Xin chào, bạn là ai?","history":[]}')
if echo "$body" | grep -qE '"response"|"answer"|"message"|"degraded"'; then
    ans=$(echo "$body" | head -c 220)
    echo "  [OK]   chat trả lời: $ans"
    pass=$((pass + 1))
else
    check "chat trả lời" "$body" "0"
fi

echo
echo "------------------------------------------"
echo "Kết quả: $pass pass / $fail fail"
echo
if [ "$pass" = "5" ]; then
    echo "Tất cả OK. Bước cuối: mở link Vercel, vào /map và /ai-chat."
else
    echo "Xem log service tương ứng trên Render Dashboard."
fi
