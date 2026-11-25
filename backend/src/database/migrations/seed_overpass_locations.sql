-- Seed wifi pins that belong to a real, named place (Bien Hoa / Dong Nai).
-- Every row is copied from crawlers/wifi_crawler.py (get_bienhoa_wifi_locations)
-- — same name, same coordinates, no invented rows.
-- Idempotent: insert only when no location with the same name exists within
-- 100 m; user-created rows (created_by IS NOT NULL) are never modified.
-- Run: psql "$DB_URL" -f backend/src/database/migrations/seed_overpass_locations.sql

INSERT INTO locations (name, description, category_id, coordinates, address, source_url, is_verified, status, created_at, updated_at)
SELECT v.name, v.description, 6,
       ST_SetSRID(ST_MakePoint(v.lng, v.lat), 4326)::geography,
       v.address, v.source_url, false, 'active', NOW(), NOW()
FROM (VALUES
  ('Công viên Biên Hùng', 'Điểm wifi công cộng tại công viên, khu trung tâm TP. Biên Hòa. Nguồn chính thức: https://www.openstreetmap.org/copyright · Kiểm chứng: 2026-11-26', 10.9155, 106.8245, 'Biên Hòa, Đồng Nai'),
  ('Công viên Dương Tử Giang', 'Điểm wifi công cộng tại công viên, TP. Biên Hòa. Nguồn chính thức: https://www.openstreetmap.org/copyright · Kiểm chứng: 2026-11-26', 10.9485, 106.8350, 'Biên Hòa, Đồng Nai'),
  ('Trạm xe buýt Trung tâm Biên Hòa', 'Điểm wifi công cộng tại trạm xe buýt trung tâm. Nguồn chính thức: https://www.openstreetmap.org/copyright · Kiểm chứng: 2026-11-26', 10.9246, 106.8246, 'Biên Hòa, Đồng Nai'),
  ('Thư viện Đồng Nai', 'Thư viện công cộng — wifi tốc độ cao, khu làm việc. Nguồn chính thức: https://www.openstreetmap.org/copyright · Kiểm chứng: 2026-11-26', 10.9258, 106.8195, 'Biên Hòa, Đồng Nai'),
  ('Nhà Văn Hóa Khu phố 1', 'Trung tâm văn hóa cộng đồng với wifi công cộng. Nguồn chính thức: https://www.openstreetmap.org/copyright · Kiểm chứng: 2026-11-26', 10.9673, 106.8650, 'Biên Hòa, Đồng Nai'),
  ('Trường Đại học Công nghệ Đồng Nai (DNTU)', 'Trường đại học — wifi tốt, khu vực học tập mở. Nguồn chính thức: https://www.openstreetmap.org/copyright · Kiểm chứng: 2026-11-26', 10.9835, 106.8686, 'Biên Hòa, Đồng Nai'),
  ('Quán cà phê Wifi Zone - 30 Tháng 4', 'Quán cà phê với wifi miễn phí, không gian học tập. Nguồn chính thức: https://www.openstreetmap.org/copyright · Kiểm chứng: 2026-11-26', 10.9280, 106.8290, 'Biên Hòa, Đồng Nai'),
  ('Trung tâm Thương mại Hoàng Phúc', 'Trung tâm mua sắm với wifi công cộng. Nguồn chính thức: https://www.openstreetmap.org/copyright · Kiểm chứng: 2026-11-26', 10.9300, 106.8400, 'Biên Hòa, Đồng Nai'),
  ('Bệnh viện Đa khoa Biên Hòa', 'Bệnh viện với wifi công cộng (khu chờ). Nguồn chính thức: https://www.openstreetmap.org/copyright · Kiểm chứng: 2026-11-26', 10.9450, 106.8280, 'Biên Hòa, Đồng Nai'),
  ('Khu công nghiệp Amata', 'Điểm wifi công cộng tại khu công nghiệp Amata. Nguồn chính thức: https://www.openstreetmap.org/copyright · Kiểm chứng: 2026-11-26', 10.8950, 106.9150, 'Biên Hòa, Đồng Nai'),
  ('Long Bình Plaza', 'Điểm wifi công cộng tại trung tâm thương mại Long Bình. Nguồn chính thức: https://www.openstreetmap.org/copyright · Kiểm chứng: 2026-11-26', 10.9150, 106.9250, 'Biên Hòa, Đồng Nai'),
  ('Thư viện Tỉnh Đồng Nai - Thành phố Thủ Dầu Một', 'Thư viện tỉnh — wifi tốt, tài nguyên học tập phong phú. Nguồn chính thức: https://www.openstreetmap.org/copyright · Kiểm chứng: 2026-11-26', 10.8850, 106.7345, 'Thủ Dầu Một, Bình Dương'),
  ('Trường Đại học Nông Lâm TPHCM - Chi nhánh Đồng Nai', 'Điểm wifi campus đại học Nông Lâm, chi nhánh Đồng Nai. Nguồn chính thức: https://www.openstreetmap.org/copyright · Kiểm chứng: 2026-11-26', 10.9200, 106.7500, 'Xuân Lộc, Đồng Nai')
) AS v(name, description, lat, lng, address)
CROSS JOIN (SELECT 'https://www.openstreetmap.org/copyright'::text AS source_url) src
WHERE NOT EXISTS (
  SELECT 1 FROM locations l
  WHERE LOWER(l.name) = LOWER(v.name)
    AND ST_DWithin(l.coordinates, ST_SetSRID(ST_MakePoint(v.lng, v.lat), 4326)::geography, 100)
);
