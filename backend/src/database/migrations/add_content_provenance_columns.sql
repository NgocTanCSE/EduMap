-- Cột provenance cho dữ liệu crawl (nguồn + ngày công bố + ảnh).
--
-- Mọi crawler (Tavily + RSS báo chí) giờ ghi kèm `source_url` (bài gốc),
-- `published_at` (ngày báo đăng) và ảnh thật của bài. Cột phải tồn tại trước
-- khi crawler chạy, nếu không `upsert_rows` sẽ bỏ qua toàn bộ dòng.
--
-- Idempotent: chạy lại nhiều lần không lỗi.
--
--   psql "$DATABASE_URL" -f backend/src/database/migrations/add_content_provenance_columns.sql

ALTER TABLE scholarships        ADD COLUMN IF NOT EXISTS image_url       TEXT;
ALTER TABLE scholarships        ADD COLUMN IF NOT EXISTS source_url      TEXT;
ALTER TABLE scholarships        ADD COLUMN IF NOT EXISTS published_at    TIMESTAMP WITH TIME ZONE;
ALTER TABLE scholarships        ADD COLUMN IF NOT EXISTS location_scope  VARCHAR(50);

ALTER TABLE events              ADD COLUMN IF NOT EXISTS source_url      TEXT;
ALTER TABLE events              ADD COLUMN IF NOT EXISTS published_at    TIMESTAMP WITH TIME ZONE;

ALTER TABLE posts               ADD COLUMN IF NOT EXISTS source          VARCHAR(100);
ALTER TABLE posts               ADD COLUMN IF NOT EXISTS source_url      TEXT;
ALTER TABLE posts               ADD COLUMN IF NOT EXISTS published_at    TIMESTAMP WITH TIME ZONE;
ALTER TABLE posts               ADD COLUMN IF NOT EXISTS location_scope  VARCHAR(50);

ALTER TABLE donation_campaigns  ADD COLUMN IF NOT EXISTS source_url      TEXT;
ALTER TABLE donation_campaigns  ADD COLUMN IF NOT EXISTS published_at    TIMESTAMP WITH TIME ZONE;
ALTER TABLE donation_campaigns  ADD COLUMN IF NOT EXISTS location_scope  VARCHAR(50);

ALTER TABLE locations           ADD COLUMN IF NOT EXISTS source_url      TEXT;
ALTER TABLE map_points          ADD COLUMN IF NOT EXISTS source_url      TEXT;

CREATE INDEX IF NOT EXISTS idx_posts_published_at      ON posts(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_scholarships_published  ON scholarships(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_source_url        ON posts(source_url);
CREATE INDEX IF NOT EXISTS idx_scholarships_source_url ON scholarships(source_url);