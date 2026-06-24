-- Seed data cho EduMap - Các bảng cần thiết để chạy được hệ thống

-- Users mẫu (cần tạo trước vì các bảng khác tham chiếu tới)
INSERT INTO users (id, email, password_hash, full_name, role_id, status, created_at, points) VALUES 
('00000000-0000-0000-0000-000000000001', 'admin@edumap.vn', '$2b$10$examplehashedpassword', 'Admin User', 1, 'active', NOW(), 0),
('00000000-0000-0000-0000-000000000002', 'user@edumap.vn', '$2b$10$examplehashedpassword', 'Demo User', 3, 'active', NOW(), 150)
ON CONFLICT (id) DO NOTHING;

-- Roles
INSERT INTO roles (id, name, description) VALUES 
(1, 'admin', 'Quản trị viên hệ thống'),
(2, 'moderator', 'Người kiểm duyệt nội dung'),
(3, 'user', 'Người dùng thông thường'),
(4, 'mentor', 'Chuyên gia mentor'),
(5, 'business', 'Doanh nghiệp')
ON CONFLICT (id) DO NOTHING;

-- Modules
INSERT INTO modules (id, name, description) VALUES 
('auth', 'Xác thực', 'Quản lý người dùng và xác thực'),
('map', 'Bản đồ', 'Bản đồ giáo dục và định vị'),
('library', 'Thư viện', 'Kho tài liệu học thuật'),
('ai', 'Trí tuệ nhân tạo', 'Chatbot và phân tích AI'),
('career', 'Nghề nghiệp', 'Lộ trình và cơ hội việc làm'),
('community', 'Cộng đồng', 'Diễn đàn và nhóm học tập'),
('mentor', 'Mentor', 'Kết nối mentor và học viên'),
('events', 'Sự kiện', 'Workshop và hội thảo'),
('scholarship', 'Học bổng', 'Tìm kiếm và apply học bổng'),
('green', 'Xanh', 'Hoạt động bảo vệ môi trường')
ON CONFLICT (id) DO NOTHING;

-- Features
INSERT INTO features (id, name, module_id, description) VALUES 
('auth-login', 'Đăng nhập', 'auth', 'API đăng nhập hệ thống'),
('auth-register', 'Đăng ký', 'auth', 'API đăng ký tài khoản'),
('map-search', 'Tìm kiếm bản đồ', 'map', 'Tìm kiếm địa điểm giáo dục'),
('map-poi', 'Điểm POIs', 'map', 'Quản lý điểm đánh dấu trên bản đồ'),
('library-search', 'Tìm tài liệu', 'library', 'Tìm kiếm tài liệu học thuật'),
('ai-chat', 'Chat AI', 'ai', 'Trò chuyện với AI assistant'),
('career-path', 'Lộ trình nghề nghiệp', 'career', 'Định hướng nghề nghiệp'),
('community-post', 'Đăng bài', 'community', 'Tạo và quản lý bài viết')
ON CONFLICT (id) DO NOTHING;

-- Badge mẫu
INSERT INTO badges (id, name, description, category, points_criteria, rarity) VALUES 
(1, 'First Login', 'Đăng nhập lần đầu', 'general', 0, 'common'),
(2, 'Green Champion', 'Tham gia thử thách xanh', 'green', 50, 'uncommon'),
(3, 'Knowledge Seeker', 'Học 10 tài liệu', 'learning', 100, 'rare'),
(4, 'Community Helper', 'Giúp đỡ 5 người', 'community', 200, 'epic')
ON CONFLICT (id) DO NOTHING;

-- Green Challenges mẫu (cần cho GreenModule hoạt động)
INSERT INTO green_challenges (id, title, description, points_reward, status, created_by, created_at) VALUES 
('550e8400-e29b-41d4-a716-446655440001', 'Tái chế rác thải nhựa', 'Gom 1kg rác nhựa để nhận điểm', 50, 'active', 
 '00000000-0000-0000-0000-000000000001', NOW()),
('550e8400-e29b-41d4-a716-446655440002', 'Sử dụng xe đưa đón công cộng', 'Đi xe buýt hoặc tàu điện 1 ngày', 30, 'active',
 '00000000-0000-0000-0000-000000000001', NOW()),
('550e8400-e29b-41d4-a716-446655440003', 'Trồng cây xanh', 'Trồng 1 cây xanh cho cộng đồng', 100, 'active',
 '00000000-0000-0000-0000-000000000001', NOW())
ON CONFLICT (id) DO NOTHING;

-- Green Challenge Activities mẫu (cần cho GreenModule hoạt động)
INSERT INTO green_challenge_activities (id, user_id, challenge_id, carbon_saved_kg, points_earned, created_at) VALUES 
('660e8400-e29b-41d4-a716-446655440001', '00000000-0000-0000-0000-000000000002', '550e8400-e29b-41d4-a716-446655440001', 2.5, 50, NOW()),
('660e8400-e29b-41d4-a716-446655440002', '00000000-0000-0000-0000-000000000002', '550e8400-e29b-41d4-a716-446655440002', 1.2, 30, NOW())
ON CONFLICT (id) DO NOTHING;

-- Business Profiles mẫu
INSERT INTO business_profiles (id, user_id, name, description, industry, is_verified, created_at) VALUES 
('770e8400-e29b-41d4-a716-446655440001', '00000000-0000-0000-0000-000000000001', 'EduMap Store', 'Cửa hàng dịch vụ giáo dục', 'Education', true, NOW())
ON CONFLICT (id) DO NOTHING;

-- Products mẫu
INSERT INTO products (id, business_profile_id, name, description, price, stock, status, created_at) VALUES 
('880e8400-e29b-41d4-a716-446655440001', '770e8400-e29b-41d4-a716-446655440001', 'Eco Notebook', 'Sổ tay tái chế', 25000, 100, 'published', NOW()),
('880e8400-e29b-41d4-a716-446655440002', '770e8400-e29b-41d4-a716-446655440001', 'Green Pen', 'Bút tay thân thiện môi trường', 15000, 200, 'published', NOW())
ON CONFLICT (id) DO NOTHING;

-- Services mẫu
INSERT INTO services (id, business_profile_id, name, description, price, status, created_at) VALUES 
('990e8400-e29b-41d4-a716-446655440001', '770e8400-e29b-41d4-a716-446655440001', 'Career Consultation', 'Tư vấn nghề nghiệp 60 phút', 500000, 'published', NOW())
ON CONFLICT (id) DO NOTHING;