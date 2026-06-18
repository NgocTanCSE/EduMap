-- =====================================================
-- EduMap Gamification Seed Data
-- =====================================================

-- =====================================================
-- 1. BADGES SEED DATA
-- =====================================================

-- Common Badges (5 badges)
INSERT INTO badges (name, description, icon_url, category, points_criteria, rarity) VALUES
('First Steps', 'Complete your profile and join EduMap', '/badges/first-steps.svg', 'onboarding', 100, 'common'),
('Explorer', 'Visit 10 different pages on EduMap', '/badges/explorer.svg', 'engagement', 200, 'common'),
('First Post', 'Create your first post in the community', '/badges/first-post.svg', 'community', 150, 'common'),
('Bookworm', 'Read your first learning material from the library', '/badges/bookworm.svg', 'learning', 150, 'common'),
('Map Pioneer', 'Add your first location to the educational map', '/badges/map-pioneer.svg', 'contribution', 200, 'common')
ON CONFLICT (name) DO NOTHING;

-- Rare Badges (5 badges)
INSERT INTO badges (name, description, icon_url, category, points_criteria, rarity) VALUES
('Community Star', 'Get 50 likes on your posts combined', '/badges/community-star.svg', 'community', 500, 'rare'),
('Mentor Match', 'Book your first mentoring session', '/badges/mentor-match.svg', 'mentorship', 400, 'rare'),
('Career Explorer', 'Complete 5 career quizzes', '/badges/career-explorer.svg', 'career', 600, 'rare'),
('Scholar Hunter', 'Apply for 3 scholarships', '/badges/scholar-hunter.svg', 'scholarship', 500, 'rare'),
('Event Enthusiast', 'Attend 5 different events', '/badges/event-enthusiast.svg', 'events', 500, 'rare')
ON CONFLICT (name) DO NOTHING;

-- Epic Badges (5 badges)
INSERT INTO badges (name, description, icon_url, category, points_criteria, rarity) VALUES
('Green Warrior', 'Complete 10 green challenges', '/badges/green-warrior.svg', 'green', 1000, 'epic'),
('Knowledge Sharer', 'Share 20 learning materials', '/badges/knowledge-sharer.svg', 'library', 1200, 'epic'),
('Community Leader', 'Create 5 study groups and get 100 members total', '/badges/community-leader.svg', 'community', 1500, 'epic'),
('Internship Champion', 'Apply for 10 internships and get 3 offers', '/badges/internship-champion.svg', 'career', 1800, 'epic'),
('Hackathon Hero', 'Win 2 hackathon competitions', '/badges/hackathon-hero.svg', 'hackathon', 2000, 'epic')
ON CONFLICT (name) DO NOTHING;

-- Legendary Badges (5 badges)
INSERT INTO badges (name, description, icon_url, category, points_criteria, rarity) VALUES
('EduMap Legend', 'Reach level 50 and earn 10,000 points', '/badges/edumap-legend.svg', 'milestone', 10000, 'legendary'),
('Master Mentor', 'Conduct 100 mentoring sessions with 4.5+ average rating', '/badges/master-mentor.svg', 'mentorship', 8000, 'legendary'),
('Global Scholar', 'Study abroad and share your experience with 50+ students', '/badges/global-scholar.svg', 'international', 9000, 'legendary'),
('Innovation Pioneer', 'Win 5 hackathons and launch 3 startup projects', '/badges/innovation-pioneer.svg', 'innovation', 12000, 'legendary'),
('EduMap Founding Father', 'Be among the first 100 users and contribute to platform development', '/badges/founding-father.svg', 'special', 15000, 'legendary')
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- 2. USER POINTS ACTIONS TEMPLATES
-- =====================================================

-- Create a reference table for point actions (optional, for documentation)
CREATE TABLE IF NOT EXISTS point_actions (
    id SERIAL PRIMARY KEY,
    action_name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    points INTEGER NOT NULL,
    category VARCHAR(100),
    daily_limit INTEGER DEFAULT 0, -- 0 = unlimited
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert point actions
INSERT INTO point_actions (action_name, description, points, category, daily_limit) VALUES
-- Engagement Actions
('login', 'Daily login', 10, 'engagement', 1),
('complete_profile', 'Complete your user profile', 100, 'onboarding', 0),
('upload_avatar', 'Upload a profile picture', 50, 'onboarding', 0),
('verify_email', 'Verify your email address', 100, 'onboarding', 0),

-- Community Actions
('create_post', 'Create a new post in community', 20, 'community', 5),
('like_post', 'Like a post', 5, 'community', 20),
('comment_post', 'Comment on a post', 10, 'community', 10),
('share_post', 'Share a post', 15, 'community', 10),
('create_group', 'Create a study group', 100, 'community', 0),
('join_group', 'Join a study group', 30, 'community', 10),

-- Learning Actions
('view_material', 'View a learning material', 5, 'learning', 50),
('download_material', 'Download a learning material', 10, 'learning', 20),
('rate_material', 'Rate a learning material', 15, 'learning', 10),
('complete_material', 'Complete a learning material', 50, 'learning', 10),

-- Career Actions
('complete_career_quiz', 'Complete a career quiz', 30, 'career', 3),
('update_career_profile', 'Update your career profile', 20, 'career', 1),
('apply_job', 'Apply for a job', 25, 'career', 5),
('apply_internship', 'Apply for an internship', 25, 'career', 5),

-- Map Actions
('add_location', 'Add a new location to the map', 50, 'map', 5),
('review_location', 'Review a location on the map', 20, 'map', 10),
('report_wifi', 'Report a free WiFi spot', 30, 'map', 5),

-- Scholarship Actions
('apply_scholarship', 'Apply for a scholarship', 30, 'scholarship', 5),
('check_eligibility', 'Check scholarship eligibility', 10, 'scholarship', 10),

-- Mentor Actions
('book_mentor', 'Book a mentoring session', 40, 'mentorship', 3),
('complete_mentoring', 'Complete a mentoring session', 60, 'mentorship', 3),
('rate_mentor', 'Rate a mentor', 15, 'mentorship', 5),

-- Event Actions
('register_event', 'Register for an event', 20, 'events', 5),
('attend_event', 'Attend an event', 50, 'events', 3),
('organize_event', 'Organize an event', 100, 'events', 0),

-- Green Actions
('complete_green_challenge', 'Complete a green challenge', 100, 'green', 1),
('submit_green_activity', 'Submit a green activity', 50, 'green', 3),
('report_carbon_saved', 'Report carbon savings', 30, 'green', 5),

-- Volunteer Actions
('log_volunteer_hours', 'Log volunteer hours', 50, 'volunteer', 1),
('complete_volunteer_activity', 'Complete a volunteer activity', 100, 'volunteer', 1),

-- Hackathon Actions
('register_hackathon', 'Register for a hackathon', 30, 'hackathon', 0),
('submit_project', 'Submit a hackathon project', 50, 'hackathon', 1),
('win_hackathon', 'Win a hackathon', 500, 'hackathon', 0),

-- Donation Actions
('make_donation', 'Make a donation', 100, 'donation', 0),
('create_campaign', 'Create a donation campaign', 150, 'donation', 0),

-- Share Actions
('share_item', 'Share an item for borrowing', 30, 'share', 5),
('borrow_item', 'Borrow an item', 20, 'share', 5),

-- Certificate Actions
('earn_certificate', 'Earn a certificate', 100, 'certificate', 0),
('verify_certificate', 'Verify a certificate', 20, 'certificate', 10),

-- Survey Actions
('complete_survey', 'Complete a survey', 30, 'survey', 3),

-- AI Actions
('use_ai_chat', 'Use AI chatbot', 5, 'ai', 20),
('get_ai_recommendation', 'Get AI recommendation', 10, 'ai', 10),

-- Special Actions
('referral_signup', 'Refer a friend who signs up', 200, 'special', 0),
('streak_7_days', 'Login 7 days in a row', 100, 'streak', 0),
('streak_30_days', 'Login 30 days in a row', 500, 'streak', 0),
('first_action', 'Perform your first action on EduMap', 50, 'onboarding', 0)

ON CONFLICT (action_name) DO NOTHING;

-- =====================================================
-- 3. LEVEL THRESHOLDS
-- =====================================================

CREATE TABLE IF NOT EXISTS level_thresholds (
    level INTEGER PRIMARY KEY,
    min_points INTEGER NOT NULL,
    max_points INTEGER NOT NULL,
    title VARCHAR(100),
    badge_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert level thresholds (1-100)
INSERT INTO level_thresholds (level, min_points, max_points, title) VALUES
(1, 0, 100, 'Newcomer'),
(2, 101, 250, 'Beginner'),
(3, 251, 500, 'Learner'),
(4, 501, 800, 'Explorer'),
(5, 801, 1200, 'Adventurer'),
(6, 1201, 1700, 'Pioneer'),
(7, 1701, 2300, 'Pathfinder'),
(8, 2301, 3000, 'Navigator'),
(9, 3001, 3800, 'Voyager'),
(10, 3801, 4700, 'Traveler'),
(11, 4701, 5700, 'Journeyer'),
(12, 5701, 6800, 'Wayfarer'),
(13, 6801, 8000, 'Trekker'),
(14, 8001, 9300, 'Hiker'),
(15, 9301, 10700, 'Climber'),
(16, 10701, 12200, 'Mountaineer'),
(17, 12201, 13800, 'Summiteer'),
(18, 13801, 15500, 'Alpinist'),
(19, 15501, 17300, 'Conqueror'),
(20, 17301, 19200, 'Champion'),
(21, 19201, 21200, 'Hero'),
(22, 21201, 23300, 'Legend'),
(23, 23301, 25500, 'Mythic'),
(24, 25501, 27800, 'Epic'),
(25, 27801, 30200, 'Legendary'),
(26, 30201, 32700, 'Mythical'),
(27, 32701, 35300, 'Divine'),
(28, 35301, 38000, 'Celestial'),
(29, 38001, 40800, 'Transcendent'),
(30, 40801, 43700, 'Ascended'),
(31, 43701, 46700, 'Enlightened'),
(32, 46701, 49800, 'Illuminated'),
(33, 49801, 53000, 'Radiant'),
(34, 53001, 56300, 'Luminous'),
(35, 56301, 59700, 'Brilliant'),
(36, 59701, 63200, 'Dazzling'),
(37, 63201, 66800, 'Blazing'),
(38, 66801, 70500, 'Inferno'),
(39, 70501, 74300, 'Supernova'),
(40, 74301, 78200, 'Celestial Nova'),
(41, 78201, 82200, 'Stellar'),
(42, 82201, 86300, 'Galactic'),
(43, 86301, 90500, 'Universal'),
(44, 90501, 94800, 'Cosmic'),
(45, 94801, 99200, 'Infinite'),
(46, 99201, 103700, 'Eternal'),
(47, 103701, 108300, 'Immortal'),
(48, 108301, 113000, 'Divine Immortal'),
(49, 113001, 117800, 'Supreme'),
(50, 117801, 122700, 'EduMap Legend'),
(51, 122701, 127700, 'Transcendent Legend'),
(52, 127701, 132800, 'Mythic Legend'),
(53, 132801, 138000, 'Epic Legend'),
(54, 138001, 143300, 'Legendary Legend'),
(55, 143301, 148700, 'Divine Legend'),
(56, 148701, 154200, 'Celestial Legend'),
(57, 154201, 159800, 'Stellar Legend'),
(58, 159801, 165500, 'Galactic Legend'),
(59, 165501, 171300, 'Universal Legend'),
(60, 171301, 177200, 'Cosmic Legend'),
(61, 177201, 183200, 'Infinite Legend'),
(62, 183201, 189300, 'Eternal Legend'),
(63, 189301, 195500, 'Immortal Legend'),
(64, 195501, 201800, 'Supreme Legend'),
(65, 201801, 208200, 'Ultimate Legend'),
(66, 208201, 214700, 'Mythic Ultimate'),
(67, 214701, 221300, 'Epic Ultimate'),
(68, 221301, 228000, 'Legendary Ultimate'),
(69, 228001, 234800, 'Divine Ultimate'),
(70, 234801, 241700, 'Celestial Ultimate'),
(71, 241701, 248700, 'Stellar Ultimate'),
(72, 248701, 255800, 'Galactic Ultimate'),
(73, 255801, 263000, 'Universal Ultimate'),
(74, 263001, 270300, 'Cosmic Ultimate'),
(75, 270301, 277700, 'Infinite Ultimate'),
(76, 277701, 285200, 'Eternal Ultimate'),
(77, 285201, 292800, 'Immortal Ultimate'),
(78, 292801, 300500, 'Supreme Ultimate'),
(79, 300501, 308300, 'Ultimate Supreme'),
(80, 308301, 316200, 'Mythic Supreme'),
(81, 316201, 324200, 'Epic Supreme'),
(82, 324201, 332300, 'Legendary Supreme'),
(83, 332301, 340500, 'Divine Supreme'),
(84, 340501, 348800, 'Celestial Supreme'),
(85, 348801, 357200, 'Stellar Supreme'),
(86, 357201, 365700, 'Galactic Supreme'),
(87, 365701, 374300, 'Universal Supreme'),
(88, 374301, 383000, 'Cosmic Supreme'),
(89, 383001, 391800, 'Infinite Supreme'),
(90, 391801, 400700, 'Eternal Supreme'),
(91, 400701, 409700, 'Immortal Supreme'),
(92, 409701, 418800, 'Supreme Supreme'),
(93, 418801, 428000, 'Ultimate Supreme Supreme'),
(94, 428001, 437300, 'Mythic Ultimate Supreme'),
(95, 437301, 446700, 'Epic Ultimate Supreme'),
(96, 446701, 456200, 'Legendary Ultimate Supreme'),
(97, 456201, 465800, 'Divine Ultimate Supreme'),
(98, 465801, 475500, 'Celestial Ultimate Supreme'),
(99, 475501, 485300, 'Stellar Ultimate Supreme'),
(100, 485301, 999999999, 'EduMap Immortal')

ON CONFLICT (level) DO NOTHING;

-- =====================================================
-- 4. SAMPLE USER BADGES (for demo users)
-- =====================================================

-- Note: This assumes demo users exist in the users table
-- Uncomment and modify user IDs as needed

-- INSERT INTO user_badges (user_id, badge_id) VALUES
-- ('demo-user-uuid-1', (SELECT id FROM badges WHERE name = 'First Steps')),
-- ('demo-user-uuid-1', (SELECT id FROM badges WHERE name = 'Explorer')),
-- ('demo-user-uuid-1', (SELECT id FROM badges WHERE name = 'First Post'))
-- ON CONFLICT (user_id, badge_id) DO NOTHING;

-- =====================================================
-- 5. SAMPLE USER POINTS (for demo users)
-- =====================================================

-- Note: This assumes demo users exist in the users table
-- Uncomment and modify user IDs as needed

-- INSERT INTO user_points (user_id, points, action, source_type) VALUES
-- ('demo-user-uuid-1', 100, 'complete_profile', 'onboarding'),
-- ('demo-user-uuid-1', 10, 'login', 'engagement'),
-- ('demo-user-uuid-1', 20, 'create_post', 'community'),
-- ('demo-user-uuid-1', 50, 'add_location', 'map'),
-- ('demo-user-uuid-1', 30, 'apply_scholarship', 'scholarship')
-- ON CONFLICT DO NOTHING;

-- =====================================================
-- 6. GAMIFICATION FUNCTIONS
-- =====================================================

-- Function to calculate user level based on total points
CREATE OR REPLACE FUNCTION calculate_user_level(total_points INTEGER)
RETURNS INTEGER AS $$
DECLARE
    user_level INTEGER;
BEGIN
    SELECT level INTO user_level
    FROM level_thresholds
    WHERE total_points >= min_points AND total_points <= max_points
    ORDER BY level DESC
    LIMIT 1;

    RETURN COALESCE(user_level, 1);
END;
$$ LANGUAGE plpgsql;

-- Function to get points needed for next level
CREATE OR REPLACE FUNCTION get_points_to_next_level(current_level INTEGER)
RETURNS INTEGER AS $$
DECLARE
    next_level_min INTEGER;
BEGIN
    SELECT min_points INTO next_level_min
    FROM level_thresholds
    WHERE level = current_level + 1;

    RETURN COALESCE(next_level_min, 0);
END;
$$ LANGUAGE plpgsql;

-- Function to grant points and update user level
CREATE OR REPLACE PROCEDURE grant_user_points(
    p_user_id UUID,
    p_points INTEGER,
    p_action VARCHAR(100),
    p_source_type VARCHAR(100),
    p_source_id UUID DEFAULT NULL
)
LANGUAGE plpgsql AS $$
DECLARE
    total_points INTEGER;
    new_level INTEGER;
BEGIN
    -- Insert points record
    INSERT INTO user_points (user_id, points, action, source_type, source_id)
    VALUES (p_user_id, p_points, p_action, p_source_type, p_source_id);

    -- Calculate total points
    SELECT COALESCE(SUM(points), 0) INTO total_points
    FROM user_points
    WHERE user_id = p_user_id;

    -- Calculate new level
    new_level := calculate_user_level(total_points);

    -- Update user level and points
    UPDATE users
    SET points = total_points,
        level = new_level,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_user_id;

    RAISE NOTICE 'Granted % points to user %. New level: %', p_points, p_user_id, new_level;
END $$;

-- =====================================================
-- 7. SEED DATA SUMMARY
-- =====================================================
-- Total badges: 20 (5 common, 5 rare, 5 epic, 5 legendary)
-- Total point actions: 50+ actions across 15 categories
-- Total levels: 100 levels with titles
-- Functions: 3 (calculate_user_level, get_points_to_next_level, grant_user_points)
-- Procedures: 1 (grant_user_points)
-- =====================================================
