-- Xoá các dòng education_stats không có nguồn.
--
-- Bộ seed cũ (`scripts/seed_education.py` + `scripts/seed_analytics_data.py`)
-- sinh metric bằng `random.uniform(...)` và để trống cột `source`. Các dòng đó
-- khiến `/api/ai/forecast/gaps` và `/api/ai/analytics/trends` đưa ra "dự báo"
-- trông rất chắc chắn nhưng không có cơ sở.
--
-- Quy tắc từ nay: một dòng education_stats chỉ được dùng khi có `source`
-- (xem `ai-service/routers/analytics.py::_filter_sourced_stats`). Dòng không
-- nguồn bị bỏ qua, nên xoá luôn khỏi DB cho sạch.
--
-- Chạy một lần trên Supabase sau khi deploy:
--   psql "$DATABASE_URL" -f backend/src/database/migrations/cleanup_synthetic_education_stats.sql

DELETE FROM education_stats
WHERE source IS NULL OR btrim(source) = '';