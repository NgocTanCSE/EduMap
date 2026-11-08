#!/usr/bin/env bash
# Nạp schema + dữ liệu EduMap lên Supabase (Postgres).
#
# Dùng pooler của Supabase (port 6543 = transaction pooler) — đây là cổng
# mặc định của project hiện tại; driver `pg` không dùng named prepared
# statement nên chạy được trên transaction pooler.
#
# Cách lấy chuỗi kết nối:
#   Supabase Dashboard → Project Settings → Database → Connection string →
#   "Transaction pooler" (URI). Dạng:
#   postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres
#
# Chạy:
#   SUPABASE_DB_URL='postgresql://...' ./scripts/init_supabase.sh
#
# Cần: psql (postgresql-client). Cài: sudo apt install postgresql-client

set -euo pipefail

cd "$(dirname "$0")/.."

if ! command -v psql >/dev/null 2>&1; then
    echo "LỖI: chưa có psql. Cài bằng: sudo apt install postgresql-client" >&2
    exit 1
fi

if [ -z "${SUPABASE_DB_URL:-}" ]; then
    echo "LỖI: thiếu SUPABASE_DB_URL." >&2
    echo "Ví dụ: SUPABASE_DB_URL='postgresql://postgres.xxx:pass@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres' $0" >&2
    exit 1
fi

run_sql() {
    local file="$1"
    local label="$2"
    echo "→ $label ($file)"
    psql "$SUPABASE_DB_URL" \
        --no-psqlrc \
        -v ON_ERROR_STOP=1 \
        -q \
        -f "$file"
    echo "  xong."
}

echo "Kết nối thử..."
psql "$SUPABASE_DB_URL" --no-psqlrc -v ON_ERROR_STOP=1 -q -c "select version();" >/dev/null
echo "  OK."

run_sql backend/src/database/schema.sql "Tạo schema"
run_sql backend/src/database/seed.sql "Nạp seed (roles, users, mentors, posts...)"
run_sql seed_crawled_data.sql "Nạp dữ liệu crawl (POI, trường, học bổng...)"

echo
echo "Kiểm tra số bản ghi:"
psql "$SUPABASE_DB_URL" --no-psqlrc -q -c "
select 'users' as bang, count(*) from users
union all select 'map_points', count(*) from map_points
union all select 'scholarships', count(*) from scholarships
union all select 'internships', count(*) from internships
union all select 'jobs', count(*) from jobs
order by 1;"

echo
echo "Hoàn tất. Giờ điền DB_HOST / DB_USERNAME / DB_PASSWORD vào Render."
