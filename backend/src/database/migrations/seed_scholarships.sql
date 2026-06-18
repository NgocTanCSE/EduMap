-- =====================================================
-- EduMap Scholarships Seed Data
-- =====================================================

-- =====================================================
-- 1. SCHOLARSHIPS SAMPLE DATA
-- =====================================================

INSERT INTO scholarships (title, description, provider, location, value_amount, deadline, eligibility_criteria, apply_url) VALUES

-- Local Scholarships (Vietnam)
('Học bổng Tài năng DNTU', 
'Học bổng dành cho sinh viên có thành tích học tập xuất sắc tại Đại học Công nghệ Đồng Nai. Áp dụng cho tất cả các ngành đào tạo hệ chính quy.',
'Dại học Công nghệ Đồng Nai',
ST_SetSRID(ST_MakePoint(107.1825, 10.9567), 4326)::geography,
50000000,
'2026-09-30 23:59:59+07',
'{"min_gpa": 3.5, "year": [1, 2, 3, 4], "full_time": true, "no_disciplinary": true}',
'https://dntu.edu.vn/hoc-bong-tai-nang'
),

('Học bổng Khuyến khích Học tập',
'Học bổng khuyến khích dành cho sinh viên có kết quả học tập tốt và tham gia tích cực các hoạt động đoàn thể.',
'Bộ Giáo dục và Đào tạo',
ST_SetSRID(ST_MakePoint(107.1825, 10.9567), 4326)::geography,
20000000,
'2026-08-31 23:59:59+07',
'{"min_gpa": 3.0, "year": [1, 2, 3, 4], "full_time": true, "activity_participation": true}',
'https://moet.gov.vn/hoc-bong'
),

('Học bổng Đồng Nai cho Sinh viên khó khăn',
'Học bổng hỗ trợ sinh viên có hoàn cảnh khó khăn tại tỉnh Đồng Nai. Ưu tiên sinh viên dân tộc thiểu số và con gia đình chính sách.',
'Ủy ban nhân dân tỉnh Đồng Nai',
ST_SetSRID(ST_MakePoint(107.1825, 10.9567), 4326)::geography,
30000000,
'2026-10-15 23:59:59+07',
'{"min_gpa": 2.5, "year": [1, 2, 3, 4], "full_time": true, "economic_difficulty": true, "ethnic_minority": false}',
'https://dongnai.gov.vn/hoc-bong'
),

('Học bổng Nữ sinh Công nghệ',
'Học bổng dành riêng cho nữ sinh viên ngành Công nghệ Thông tin, Khoa học Máy tính và các ngành liên quan. Mục tiêu tăng tỷ lệ nữ trong ngành IT.',
'Hiệp hội CNTT Việt Nam',
ST_SetSRID(ST_MakePoint(107.1825, 10.9567), 4326)::geography,
25000000,
'2026-07-31 23:59:59+07',
'{"min_gpa": 3.0, "year": [1, 2, 3], "gender": "female", "fields": ["Computer Science", "Information Technology", "Software Engineering"]}',
'https://vinasa.org.vn/hoc-bong-nu-sinh'
),

('Học bổng Du học Nhật Bản JASSO',
'Học bổng dành cho sinh viên Việt Nam muốn du học tại Nhật Bản. Bao gồm học phí và chi phí sinh hoạt trong 1 năm đầu.',
'Japan Student Services Organization (JASSO)',
ST_SetSRID(ST_MakePoint(139.6917, 35.6895), 4326)::geography,
120000000,
'2026-04-30 23:59:59+07',
'{"min_gpa": 3.2, "year": [2, 3], "full_time": true, "japanese_level": "N3", "under_25": true}',
'https://www.jasso.go.jp/en/ryugaku奖学金/'
),

-- International Scholarships
('Fulbright Vietnamese Student Program',
'Chương trình học bổng Fulbright dành cho sinh viên Việt Nam muốn học thạc sĩ tại Hoa Kỳ. Bao gồm toàn bộ chi phí học tập và sinh hoạt.',
'U.S. Department of State',
ST_SetSRID(ST_MakePoint(-77.0369, 38.9072), 4326)::geography,
500000000,
'2026-05-15 23:59:59+07',
'{"min_gpa": 3.5, "experience": "2+ years", "english_level": "TOEFL 80+", "leadership": true, "community_service": true}',
'https://fulbrightvietnam.org/apply/'
),

('Chevening Scholarship',
'Học bổng của chính phủ Vương quốc Anh cho chương trình thạc sĩ tại các trường đại học Anh. Yêu cầu kinh nghiệm làm việc 2+ năm.',
'UK Government (FCDO)',
ST_SetSRID(ST_MakePoint(-0.1276, 51.5074), 4326)::geography,
450000000,
'2026-11-02 23:59:59+07',
'{"min_gpa": 3.0, "experience": "2+ years", "english_level": "IELTS 6.5+", "leadership": true, "return_to_home": true}',
'https://www.chevening.org/scholarships/'
),

('Australia Awards Scholarships',
'Học bổng của chính phủ Australia cho sinh viên từ các nước đang phát triển. Áp dụng cho chương trình thạc sĩ và nghiên cứu sinh.',
'Department of Foreign Affairs and Trade (DFAT)',
ST_SetSRID(ST_MakePoint(149.1300, -35.2809), 4326)::geography,
400000000,
'2026-04-30 23:59:59+07',
'{"min_gpa": 3.0, "experience": "2+ years", "english_level": "IELTS 6.5+", "development_impact": true, "return_to_home": true}',
'https://www.dfat.gov.au/people-to-people/australia-awards'
),

('Erasmus Mundus Joint Master Degree',
'Chương trình thạc sĩ chung của EU, sinh viên học tại 2-3 trường đại học ở châu Âu. Bao gồm học phí, chi phí sinh hoạt và bảo hiểm.',
'European Commission',
ST_SetSRID(ST_MakePoint(4.3517, 50.8503), 4326)::geography,
350000000,
'2026-01-15 23:59:59+07',
'{"min_gpa": 3.0, "year": [3, 4], "english_level": "IELTS 6.5+", "bachelor_degree": true, "under_35": true}',
'https://erasmus-plus.ec.europa.eu/scholarships'
),

('DAAD Scholarship for Development',
'Học bổng của DAAD (Đức) cho sinh viên từ các nước đang phát triển muốn học thạc sĩ tại Đức. Ưu tiên các ngành liên quan đến phát triển.',
'Deutscher Akademischer Austauschdienst (DAAD)',
ST_SetSRID(ST_MakePoint(13.4050, 52.5200), 4326)::geography,
300000000,
'2026-10-15 23:59:59+07',
'{"min_gpa": 3.0, "experience": "2+ years", "german_level": "B1", "development_focus": true, "under_36": true}',
'https://www.daad.de/en/study-and-research-in-germany/scholarships/'
),

-- STEM Scholarships
('Học bổng STEM Vietnam',
'Học bổng dành cho sinh viên ngành Khoa học, Công nghệ, Kỹ thuật và Toán học. Ưu tiên nghiên cứu và đổi mới sáng tạo.',
'Quỹ Hỗ trợ STEM Việt Nam',
ST_SetSRID(ST_MakePoint(107.1825, 10.9567), 4326)::geography,
40000000,
'2026-06-30 23:59:59+07',
'{"min_gpa": 3.3, "year": [2, 3, 4], "fields": ["STEM"], "research_interest": true, "innovation": true}',
'https://stemvietnam.org/hoc-bong'
),

('Google Generation Scholarship', 
'Học bổng của Google dành cho sinh viên từ các nhóm underrepresented trong ngành công nghệ. Ưu tiên nữ sinh, sinh viên da màu, và người khuyết tật.',
'Google',
ST_SetSRID(ST_MakePoint(-122.0841, 37.4220), 4326)::geography,
200000000,
'2026-12-01 23:59:59+07',
'{"min_gpa": 3.0, "year": [2, 3], "fields": ["Computer Science", "Engineering"], "underrepresented": true, "community_involvement": true}',
'https://buildyourfuture.withgoogle.com/scholarships'
),

('Microsoft Imagine Cup Scholarship',
'Học bổng dành cho sinh viên có dự án đổi mới sáng tạo sử dụng công nghệ Microsoft. Ưu tiên dự án giải quyết vấn đề xã hội.',
'Microsoft',
ST_SetSRID(ST_MakePoint(-122.1215, 47.6815), 4326)::geography,
150000000,
'2026-03-31 23:59:59+07',
'{"min_gpa": 3.0, "year": [2, 3, 4], "fields": ["Technology", "Engineering"], "innovation": true, "social_impact": true}',
'https://imaginecup.microsoft.com/'
),

('Samsung Innovation Campus Scholarship',
'Học bổng của Samsung dành cho sinh viên có thành tích xuất sắc trong lĩnh vực đổi mới sáng tạo và công nghệ.',
'Samsung Electronics',
ST_SetSRID(ST_MakePoint(126.9780, 37.5665), 4326)::geography,
100000000,
'2026-08-15 23:59:59+07',
'{"min_gpa": 3.2, "year": [2, 3], "fields": ["Technology", "Engineering", "Design"], "innovation": true}',
'https://www.samsung.com/global/innovation-campus/'
),

-- Research Scholarships
('Học bổng Nghiên cứu sinh博士',
'Học bổng dành cho nghiên cứu sinh tiến sĩ tại các trường đại học hàng đầu. Bao gồm toàn bộ chi phí nghiên cứu và sinh hoạt.',
'Bộ Giáo dục và Đào tạo',
ST_SetSRID(ST_MakePoint(107.1825, 10.9567), 4326)::geography,
200000000,
'2026-03-15 23:59:59+07',
'{"degree": "PhD", "min_gpa": 3.5, "research_proposal": true, "publications": "preferred", "under_35": true}',
'https://moet.gov.vn/tim-kiem?q=hoc+bong+ncs'
)

ON CONFLICT (title) DO NOTHING;

-- =====================================================
-- 2. SCHOLARSHIP CATEGORIES
-- =====================================================

CREATE TABLE IF NOT EXISTS scholarship_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    icon VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO scholarship_categories (name, description, icon) VALUES
('Local', 'Học bổng trong nước', 'flag'),
('International', 'Học bổng quốc tế', 'globe'),
('STEM', 'Học bổng ngành Khoa học và Công nghệ', 'flask'),
('Research', 'Học bổng nghiên cứu', 'search'),
('Need-based', 'Học bổng dựa trên hoàn cảnh', 'heart'),
('Merit-based', 'Học bổng dựa trên thành tích', 'award'),
('Women', 'Học bổng dành cho nữ sinh', 'female'),
('Minority', 'Học bổng dành cho dân tộc thiểu số', 'users')

ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- 3. SCHOLARSHIP APPLICATIONS SAMPLE
-- =====================================================

-- Note: This assumes demo users and scholarships exist
-- Uncomment and modify IDs as needed

-- INSERT INTO scholarship_applications (scholarship_id, user_id, status, documents, personal_statement) VALUES
-- ((SELECT id FROM scholarships WHERE title = 'Học bổng Tài năng DNTU' LIMIT 1),
--  'demo-user-uuid-1',
--  'pending',
--  '{"transcript": "path/to/transcript.pdf", "recommendation_letter": "path/to/letter.pdf"}',
--  'Em rất mong muốn nhận được học bổng này để tiếp tục phát triển bản thân...')
-- ON CONFLICT DO NOTHING;

-- =====================================================
-- SUMMARY
-- =====================================================
-- Total scholarships: 15 (4 local, 6 international, 3 STEM, 2 research)
-- Total categories: 8 categories
-- Each scholarship has detailed eligibility_criteria JSONB
-- =====================================================
