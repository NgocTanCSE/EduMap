-- seed_demo_data.sql
-- Direct Postgres-only seeding (bypasses the REST API) — same pattern used for the
-- `bookmarks` table. Idempotent: DELETEs each target table first, then INSERTs
-- sample rows with FK-valid ids pulled from existing rows via subqueries, so it
-- never violates FK/unique constraints and can be re-run after execute_db_setup.py.
--
-- Run:  docker exec -e PGPASSWORD="$DB_PASSWORD" edumap_postgres \
--   psql -U "$DB_USERNAME" -d "$DB_DATABASE" -h localhost -f /EduMap/scripts/seed_demo_data.sql

\echo '== seed_demo_data: inserting sample rows directly into Postgres =='

BEGIN;

-- 1) WiFi locations  -> powers the /wifi page (wifi_locations = 0)
DELETE FROM wifi_locations;
INSERT INTO wifi_locations (name, address, provider, hint, reported_by, verified, rating_avg, is_free, speed_mbps, location_point)
SELECT
  'Wifi '||g,
  'Số '||g||' đường số '||g||', Quận '||((g%3)+1)||', TP.HCM',
  CASE WHEN g%2=0 THEN 'Viettel' ELSE 'FPT' END,
  'Góc học '||g,
  (SELECT id FROM users ORDER BY id LIMIT 1 OFFSET (g%5)),
  true,
  4.0 + (g%3),
  (g%3 <> 0),
  25 + g*7,
  ST_SetSRID(ST_Point(106.6602 + g*0.0015, 10.7626 + g*0.0015), 4326)::geography
FROM generate_series(1,6) g;

-- 2) Event registrations  -> /events interaction (UNIQUE event_id+user_id, ticket_code)
DELETE FROM event_registrations;
INSERT INTO event_registrations (user_id, event_id, status, ticket_code, feedback_rating)
SELECT
  (SELECT id FROM users ORDER BY id LIMIT 1 OFFSET (g%5)),
  (SELECT id FROM events WHERE deleted_at IS NULL ORDER BY id LIMIT 1 OFFSET (g%3)),
  CASE WHEN g%2=0 THEN 'registered' ELSE 'attended' END,
  'TIX-'||lpad(g::text,4,'0'),
  (g%5)
FROM generate_series(1,5) g;

-- 3) Map POI reviews  -> /map feedback (UNIQUE point_id+user_id)
DELETE FROM map_reviews;
INSERT INTO map_reviews (point_id, user_id, rating, comment, helpful_count)
SELECT
  (SELECT id FROM map_points WHERE deleted_at IS NULL ORDER BY id LIMIT 1 OFFSET (g%5)),
  (SELECT id FROM users ORDER BY id LIMIT 1 OFFSET (g%6)),
  4 + (g%2),
  'Đánh giá '||g,
  (g%10)
FROM generate_series(1,6) g;

-- 4) Material ratings  -> /library feedback (UNIQUE material_id+user_id)
DELETE FROM material_ratings;
INSERT INTO material_ratings (material_id, user_id, rating, review)
SELECT
  (SELECT id FROM learning_materials WHERE deleted_at IS NULL ORDER BY id LIMIT 1 OFFSET (g%5)),
  (SELECT id FROM users ORDER BY id LIMIT 1 OFFSET (g%6)),
  3 + (g%3),
  'Review '||g
FROM generate_series(1,6) g;

-- 5) Borrow requests  -> /library loans (item_id -> shared_items)
DELETE FROM borrow_requests;
INSERT INTO borrow_requests (item_id, requester_id, status, message)
SELECT
  (SELECT id FROM shared_items ORDER BY id LIMIT 1 OFFSET (g%4)),
  (SELECT id FROM users ORDER BY id LIMIT 1 OFFSET (g%5)),
  CASE WHEN g%3=0 THEN 'approved' WHEN g%3=1 THEN 'pending' ELSE 'returned' END,
  'Yêu cầu mượn '||g
FROM generate_series(1,4) g;

-- 6) Green activities  -> sustainability feed
DELETE FROM green_activities;
INSERT INTO green_activities (user_id, challenge_id, carbon_saved_kg, points_earned, description)
SELECT
  (SELECT id FROM users ORDER BY id LIMIT 1 OFFSET (g%5)),
  (SELECT id FROM green_challenges ORDER BY id LIMIT 1 OFFSET (g%3)),
  (10+g)::numeric(10,2),
  g*10,
  'Hoạt động xanh '||g
FROM generate_series(1,5) g;

-- 7) User badges  -> gamification (UNIQUE user_id+badge_id)
DELETE FROM user_badges;
INSERT INTO user_badges (user_id, badge_id, earned_at)
SELECT
  (SELECT id FROM users ORDER BY id LIMIT 1 OFFSET (g%6)),
  (SELECT id FROM badges ORDER BY id LIMIT 1 OFFSET (g%5)),
  now() - (g||' days')::interval
FROM generate_series(1,6) g;

-- 8) User points  -> gamification
DELETE FROM user_points;
INSERT INTO user_points (user_id, points, source_type, source_id, action)
SELECT
  (SELECT id FROM users ORDER BY id LIMIT 1 OFFSET (g%5)),
  g*50,
  'login',
  NULL,
  'earned'
FROM generate_series(1,6) g;

-- 9) Role permissions  -> RBAC wiring (role_id int -> permissions int)
DELETE FROM role_permissions;
INSERT INTO role_permissions (role_id, permission_id)
SELECT
  (SELECT id FROM roles ORDER BY id LIMIT 1),
  (SELECT id FROM permissions ORDER BY id LIMIT 1 OFFSET (g%4))
FROM generate_series(1,4) g;

-- 10) Scholarship applications  -> /career application flow (UNIQUE student+scholarship)
DELETE FROM scholarship_applications;
INSERT INTO scholarship_applications (student_id, scholarship_id, status, personal_statement)
SELECT
  (SELECT id FROM users ORDER BY id LIMIT 1 OFFSET (g%3)),
  (SELECT id FROM scholarships WHERE deleted_at IS NULL ORDER BY id LIMIT 1 OFFSET (g%3)),
  'pending',
  'Đơn ứng tuyển học bổng '||g
FROM generate_series(1,3) g;

-- 11) Internship applications  -> /career application flow
DELETE FROM internship_applications;
INSERT INTO internship_applications (user_id, internship_id, status, cover_letter)
SELECT
  (SELECT id FROM users ORDER BY id LIMIT 1 OFFSET (g%3)),
  (SELECT id FROM internships ORDER BY id LIMIT 1 OFFSET (g%3)),
  'reviewing',
  'Thư xin ứng tuyển '||g
FROM generate_series(1,3) g;

COMMIT;
\echo '== seed_demo_data: done =='
