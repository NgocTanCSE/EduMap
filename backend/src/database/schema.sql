-- EduMap Database Schema - Part 1
-- Requirements: PostgreSQL with PostGIS extension

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- 2. roles
CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    display_name VARCHAR(255),
    description TEXT,
    level INTEGER DEFAULT 0,
    system_created BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. permissions
CREATE TABLE permissions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    resource VARCHAR(255),
    action VARCHAR(50), -- CRUD
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. role_permissions
CREATE TABLE role_permissions (
    role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
    permission_id INTEGER REFERENCES permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (role_id, permission_id)
);

-- 0. user_role_enum (native PostgreSQL enum — replaces magic role_id per CA02)
CREATE TYPE user_role_enum AS ENUM (
    'super_admin', 'admin', 'moderator', 'school_rep',
    'university_rep', 'business_partner', 'sponsor',
    'teacher', 'mentor', 'volunteer', 'student', 'guest'
);

-- 1. users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    two_factor_secret VARCHAR(255),
    is_two_factor_enabled BOOLEAN DEFAULT false,
    refresh_token_hash VARCHAR(255),
    full_name VARCHAR(255),
    phone VARCHAR(20),
    avatar_url TEXT,
    date_of_birth DATE,
    major VARCHAR(255),
    bio TEXT,
    mbti_type VARCHAR(50),
    skills TEXT[] DEFAULT '{}',
    interests TEXT[] DEFAULT '{}',
    points INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    role user_role_enum DEFAULT 'student',
    status VARCHAR(50) DEFAULT 'active',
    email_verified BOOLEAN DEFAULT false,
    provider VARCHAR(50) DEFAULT 'local',
    provider_id VARCHAR(255),
    location GEOGRAPHY(POINT),
    last_login TIMESTAMP WITH TIME ZONE,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_location ON users USING GIST(location);

-- 5. modules
CREATE TABLE modules (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE features (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    module_id VARCHAR(255) REFERENCES modules(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. map_categories
CREATE TABLE map_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    icon VARCHAR(255),
    color VARCHAR(7),
    parent_id INTEGER REFERENCES map_categories(id),
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true
);

-- 5. map_points
CREATE TABLE map_points (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type_id INTEGER REFERENCES map_categories(id),
    location GEOGRAPHY(POINT) NOT NULL,
    address TEXT,
    city VARCHAR(100),
    district VARCHAR(100),
    province VARCHAR(100),
    photos JSONB, -- Array of URLs
    rating_avg DECIMAL(3,2) DEFAULT 0,
    rating_count INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'pending',
    verified BOOLEAN DEFAULT false,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_map_points_location ON map_points USING GIST(location);
CREATE INDEX idx_map_points_type ON map_points(type_id);

-- 7.5. pins (dang tin len ban do: su kien, quang ca, green, sach, wifi...)
CREATE TABLE pins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    content TEXT,
    type VARCHAR(50) DEFAULT 'event', -- event|ad|green|book|wifi|note|other
    poster_name VARCHAR(255),
    posted_by UUID REFERENCES users(id) ON DELETE SET NULL,
    location GEOMETRY(Geometry, 4326), -- Point (cho co su kien) hoac LineString (tu khu nao den khu kia)
    city VARCHAR(255),
    district VARCHAR(255),
    province VARCHAR(255),
    status VARCHAR(100) DEFAULT 'pending', -- pending|published|rejected (quan tri vien duyet)
    photos JSONB,
    tags JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT chk_pins_type CHECK (type IN ('event','ad','green','book','wifi','note','other')),
    CONSTRAINT chk_pins_status CHECK (status IN ('pending','published','rejected'))
);
CREATE INDEX idx_pins_location ON pins USING GIST(location);
CREATE INDEX idx_pins_posted_by ON pins(posted_by);
CREATE INDEX idx_pins_status_type ON pins(status, type);

-- 7. map_reviews
CREATE TABLE map_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    point_id UUID REFERENCES map_points(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    photos JSONB,
    helpful_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(point_id, user_id)
);

-- 8. learning_materials
CREATE TABLE learning_materials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50), -- video/pdf/course
    subject VARCHAR(100),
    grade VARCHAR(50),
    tags JSONB, -- Array of strings
    file_url TEXT,
    file_size BIGINT,
    thumbnail_url TEXT,
    download_count INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    rating_avg DECIMAL(3,2) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'draft', -- draft/review/published
    author_id UUID REFERENCES users(id),
    is_offline_available BOOLEAN DEFAULT false,
    search_vector TSVECTOR,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_learning_materials_search ON learning_materials USING GIN(search_vector);

-- 9. material_ratings
CREATE TABLE material_ratings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    material_id UUID REFERENCES learning_materials(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    review TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(material_id, user_id)
);

-- 10. events
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    type VARCHAR(100), -- workshop/hackathon/seminar/camp
    location_point GEOGRAPHY(POINT),
    address TEXT,
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    capacity INTEGER,
    registered_count INTEGER DEFAULT 0,
    banner_url TEXT,
    organizer_id UUID REFERENCES users(id),
    status VARCHAR(50) DEFAULT 'upcoming',
    tags JSONB,
    is_online BOOLEAN DEFAULT false,
    meeting_url TEXT,
    price DECIMAL(15,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_events_dates ON events(start_date, end_date);


-- EduMap Database Schema - Part 2 (Tables 11-20)

-- 11. event_registrations
CREATE TABLE event_registrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'registered', -- registered/attended/cancelled
    ticket_code VARCHAR(100) UNIQUE,
    checked_in_at TIMESTAMP WITH TIME ZONE,
    feedback_rating INTEGER,
    feedback_text TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(event_id, user_id)
);

-- 12. opportunities
CREATE TABLE opportunities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(100), -- scholarship/internship/hackathon/research
    organization VARCHAR(255),
    location_point GEOGRAPHY(POINT),
    address VARCHAR(255),
    deadline TIMESTAMP WITH TIME ZONE,
    requirements TEXT,
    benefits TEXT,
    url TEXT,
    field_tags JSONB,
    region VARCHAR(100),
    status VARCHAR(50) DEFAULT 'open',
    created_by UUID REFERENCES users(id),
    is_team_finding_open BOOLEAN DEFAULT false,
    tags JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- 13. ai_conversations
CREATE TABLE ai_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255),
    model VARCHAR(100),
    total_tokens INTEGER DEFAULT 0,
    context_summary TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 14. ai_messages
CREATE TABLE ai_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES ai_conversations(id) ON DELETE CASCADE,
    role VARCHAR(50), -- user/assistant
    content TEXT NOT NULL,
    tokens INTEGER,
    used_sources JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 15. badges
CREATE TABLE badges (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    icon_url TEXT,
    category VARCHAR(100),
    points_criteria INTEGER,
    rarity VARCHAR(50), -- common/rare/epic/legendary
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 16. user_badges
CREATE TABLE user_badges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    badge_id INTEGER REFERENCES badges(id) ON DELETE CASCADE,
    earned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, badge_id)
);

-- 17. user_points
CREATE TABLE user_points (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    points INTEGER NOT NULL,
    action VARCHAR(255),
    source_type VARCHAR(100),
    source_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 20. groups
CREATE TABLE groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    avatar_url TEXT,
    cover_url TEXT,
    type VARCHAR(50), -- study/club/project
    member_count INTEGER DEFAULT 1,
    privacy VARCHAR(50) DEFAULT 'public', -- public/private
    owner_id UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- 18. posts
CREATE TABLE posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    author_id UUID REFERENCES users(id) ON DELETE SET NULL,
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    title VARCHAR(255),
    content TEXT NOT NULL,
    media_urls JSONB,
    tags JSONB,
    like_count INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'active',
    pinned BOOLEAN DEFAULT false,
    search_vector TSVECTOR,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- 19. comments
CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
    author_id UUID REFERENCES users(id) ON DELETE SET NULL,
    parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    like_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);


-- EduMap Database Schema - Part 3 (Tables 21-30)

-- 21. mentors
CREATE TABLE mentors (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    bio TEXT,
    specialties JSONB,
    experience_years INTEGER,
    rating_avg DECIMAL(3,2) DEFAULT 0,
    total_sessions INTEGER DEFAULT 0,
    hourly_rate DECIMAL(15,2),
    availability_json JSONB,
    is_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 22. bookings
CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mentor_id UUID REFERENCES mentors(user_id) ON DELETE CASCADE,
    student_id UUID REFERENCES users(id) ON DELETE CASCADE,
    slot_start TIMESTAMP WITH TIME ZONE NOT NULL,
    slot_end TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(50) DEFAULT 'pending', -- pending/confirmed/completed/cancelled
    meeting_url TEXT,
    notes TEXT,
    rating INTEGER,
    feedback TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 24. donation_campaigns
CREATE TABLE donation_campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    target_amount DECIMAL(15,2),
    current_amount DECIMAL(15,2) DEFAULT 0,
    organizer_id UUID REFERENCES users(id),
    location_point GEOGRAPHY(POINT),
    status VARCHAR(50) DEFAULT 'active',
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    images JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 23. donations
CREATE TABLE donations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    donor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    campaign_id UUID REFERENCES donation_campaigns(id) ON DELETE CASCADE,
    amount DECIMAL(15,2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'VND',
    payment_method VARCHAR(50),
    payment_status VARCHAR(50) DEFAULT 'pending',
    transaction_id VARCHAR(255),
    is_anonymous BOOLEAN DEFAULT false,
    receipt_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 25. volunteer_activities
CREATE TABLE volunteer_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    campaign_name VARCHAR(255),
    hours INTEGER,
    location_point GEOGRAPHY(POINT),
    date DATE,
    proof_urls JSONB,
    status VARCHAR(50) DEFAULT 'pending', -- pending/verified
    volunteer_id UUID REFERENCES users(id) ON DELETE CASCADE,
    verified_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 26. certificates
CREATE TABLE certificates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(100), -- workshop/volunteer/course
    title VARCHAR(255) NOT NULL,
    description TEXT,
    issued_at DATE,
    issuer VARCHAR(255),
    verify_code VARCHAR(100) UNIQUE,
    qr_url TEXT,
    pdf_url TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 27. surveys
CREATE TABLE surveys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    questions_json JSONB NOT NULL,
    created_by UUID REFERENCES users(id),
    status VARCHAR(50) DEFAULT 'active',
    response_count INTEGER DEFAULT 0,
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    target_roles JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 28. survey_responses
CREATE TABLE survey_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    survey_id UUID REFERENCES surveys(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    answers_json JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(survey_id, user_id)
);

-- 29. notifications
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    body TEXT,
    data_json JSONB,
    is_read BOOLEAN DEFAULT false,
    channel VARCHAR(50), -- push/email/in_app
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP WITH TIME ZONE
);

-- 30. green_challenges
CREATE TABLE green_challenges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(100), -- recycle/plant/save
    start_date DATE,
    end_date DATE,
    points_reward INTEGER,
    participant_count INTEGER DEFAULT 0,
    created_by UUID REFERENCES users(id),
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


-- EduMap Database Schema - Part 4 (Tables 31-40)

-- 31. green_activities
CREATE TABLE green_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    challenge_id UUID REFERENCES green_challenges(id) ON DELETE SET NULL,
    activity_type VARCHAR(50),
    description TEXT,
    proof_url TEXT,
    ai_confidence DECIMAL(5,2) DEFAULT 0,
    moderator_note TEXT,
    carbon_saved_kg DECIMAL(10,2) DEFAULT 0,
    points_earned INTEGER,
    status VARCHAR(50) DEFAULT 'verified',
    verified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 31b. green_challenge_activities (Track individual user participation in challenges)
CREATE TABLE green_challenge_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    challenge_id UUID NOT NULL REFERENCES green_challenges(id) ON DELETE CASCADE,
    carbon_saved_kg DECIMAL(10,2) DEFAULT 0,
    points_earned INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 32. career_paths
CREATE TABLE career_paths (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    field VARCHAR(100),
    description TEXT,
    skills_required JSONB,
    roadmap_json JSONB,
    salary_range VARCHAR(100),
    demand_level VARCHAR(50),
    resources JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 33. wifi_locations
CREATE TABLE wifi_locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255),
    location_point GEOGRAPHY(POINT) NOT NULL,
    address TEXT,
    speed_mbps INTEGER,
    is_free BOOLEAN DEFAULT true,
    password VARCHAR(100),
    hint TEXT,
    provider VARCHAR(255),
    rating_avg DECIMAL(3,2) DEFAULT 0,
    verified BOOLEAN DEFAULT false,
    reported_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 34. stem_labs
CREATE TABLE stem_labs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    school_id UUID, -- Optional link to a school table
    location_point GEOGRAPHY(POINT) NOT NULL,
    description TEXT,
    equipment JSONB,
    location_point_text TEXT, -- For specific room/floor
    capacity INTEGER,
    booking_available BOOLEAN DEFAULT true,
    photos JSONB,
    contact VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 35. chat_messages
CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
    receiver_id UUID REFERENCES users(id) ON DELETE CASCADE,
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    media_url TEXT,
    type VARCHAR(50) DEFAULT 'text', -- text/image/file
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


-- 35.1. chat_histories (AI Chat History)
CREATE TABLE chat_histories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    response TEXT NOT NULL,
    context JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_chat_histories_user ON chat_histories(user_id);

-- 36. audit_logs
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(255) NOT NULL,
    resource VARCHAR(255),
    resource_id VARCHAR(255),
    old_data JSONB,
    new_data JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 37. education_stats
CREATE TABLE education_stats (
    id SERIAL PRIMARY KEY,
    region VARCHAR(100),
    province VARCHAR(100),
    district VARCHAR(100),
    metric_type VARCHAR(100), -- literacy_rate/enrollment/graduation
    metric_value DECIMAL(15,2),
    year INTEGER,
    source VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 38. user_learning_history
CREATE TABLE user_learning_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    material_id UUID REFERENCES learning_materials(id) ON DELETE CASCADE,
    action VARCHAR(50), -- view/download/complete
    progress_pct INTEGER DEFAULT 0,
    time_spent_sec INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 39. support_tickets
CREATE TABLE support_tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    subject VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    priority VARCHAR(50) DEFAULT 'normal', -- low/normal/high/critical
    status VARCHAR(50) DEFAULT 'open', -- open/in_progress/resolved/closed
    assigned_to UUID REFERENCES users(id),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 40. internships
CREATE TABLE internships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    title VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    field VARCHAR(100),
    location_point GEOGRAPHY(POINT),
    salary_range VARCHAR(100),
    duration VARCHAR(50),
    requirements TEXT,
    benefits TEXT,
    deadline DATE,
    application_count INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'open',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 41. shared_items
CREATE TABLE shared_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100), -- book/equipment/etc
    description TEXT,
    status VARCHAR(50) DEFAULT 'available', -- available/taken/exchanged
    owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 42. borrow_requests
CREATE TABLE borrow_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id UUID REFERENCES shared_items(id) ON DELETE CASCADE,
    requester_id UUID REFERENCES users(id) ON DELETE CASCADE,
    message TEXT,
    status VARCHAR(50) DEFAULT 'pending', -- pending/approved/rejected/returned
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 43. location_categories (Matches LocationCategory entity)
CREATE TABLE location_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    display_name VARCHAR(255),
    icon_name VARCHAR(255),
    marker_color VARCHAR(50)
);

-- 44. locations (Matches Location entity)
CREATE TABLE locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category_id INTEGER REFERENCES location_categories(id),
    coordinates GEOGRAPHY(POINT, 4326) NOT NULL,
    address TEXT,
    city VARCHAR(100),
    photos JSONB,
    rating_avg DECIMAL(3,2) DEFAULT 0,
    rating_count INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'active',
    is_verified BOOLEAN DEFAULT false,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_locations_coordinates ON locations USING GIST (coordinates);
CREATE INDEX idx_locations_category ON locations(category_id);
CREATE INDEX idx_locations_status ON locations(status);

-- 45. scholarships (Matches Scholarship entity)
CREATE TABLE scholarships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    provider VARCHAR(255),
    location GEOGRAPHY(POINT, 4326),
    value_amount DECIMAL(15,2),
    deadline TIMESTAMP WITH TIME ZONE,
    eligibility_criteria JSONB,
    apply_url TEXT,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX idx_scholarships_deadline ON scholarships(deadline);

-- 46. jobs (Career module - Job entity)
CREATE TYPE job_type_enum AS ENUM ('full_time', 'part_time', 'internship', 'freelance', 'contract', 'course');
CREATE TYPE job_status_enum AS ENUM ('active', 'inactive', 'closed', 'pending');

CREATE TABLE jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    company_name VARCHAR(255),
    location VARCHAR(255),
    job_type job_type_enum DEFAULT 'full_time',
    salary_range VARCHAR(100),
    required_skills JSONB,
    experience_level VARCHAR(100),
    application_deadline TIMESTAMP WITH TIME ZONE,
    views INTEGER DEFAULT 0,
    status job_status_enum DEFAULT 'active',
    posted_by_user_id UUID REFERENCES users(id),
    career_path_id INTEGER REFERENCES career_paths(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_jobs_title ON jobs(title);
CREATE INDEX idx_jobs_status ON jobs(status);

-- 47. user_careers (Career module - UserCareer entity)
CREATE TYPE user_career_status_enum AS ENUM ('active', 'inactive', 'completed');

CREATE TABLE user_careers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    career_path_id INTEGER REFERENCES career_paths(id) ON DELETE SET NULL,
    goal_title VARCHAR(255) NOT NULL,
    description TEXT,
    target_date DATE,
    status user_career_status_enum DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_user_careers_user ON user_careers(user_id);

-- 48. user_skills (Career module - UserSkill entity)
CREATE TYPE skill_proficiency_enum AS ENUM ('beginner', 'intermediate', 'advanced', 'expert');

CREATE TABLE user_skills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    skill_name VARCHAR(255) NOT NULL,
    proficiency_level skill_proficiency_enum DEFAULT 'beginner',
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_user_skills_user ON user_skills(user_id);
CREATE INDEX idx_user_skills_name ON user_skills(skill_name);

-- 49. applications (Career module - Application entity)
CREATE TYPE application_status_enum AS ENUM ('pending', 'reviewed', 'accepted', 'rejected', 'withdrawn');

CREATE TABLE applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
    cover_letter TEXT,
    resume_url VARCHAR(255),
    status application_status_enum DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_applications_user ON applications(user_id);
CREATE INDEX idx_applications_job ON applications(job_id);

-- 50. business_profiles (Matches BusinessProfile entity)
CREATE TABLE business_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE REFERENCES users(id),
    name VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    industry VARCHAR(255),
    website VARCHAR(255),
    logo_url TEXT,
    address TEXT,
    is_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 51. products (Matches Product entity)
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(15,2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'VND',
    category VARCHAR(100),
    stock INTEGER DEFAULT 0,
    image_url TEXT,
    business_profile_id UUID REFERENCES business_profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 52. business_services (Matches Service entity)
CREATE TABLE business_services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(15,2) NOT NULL,
    category VARCHAR(100),
    duration VARCHAR(100),
    location VARCHAR(255),
    business_profile_id UUID REFERENCES business_profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 53. international_programs (Matches InternationalProgram entity)
CREATE TABLE international_programs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL,
    description TEXT,
    host_country VARCHAR(255),
    organization VARCHAR(255),
    application_deadline TIMESTAMP WITH TIME ZONE,
    benefits JSONB,
    apply_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 54. alumni_networks (Matches AlumniNetwork entity)
CREATE TABLE alumni_networks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name VARCHAR(255) NOT NULL,
    university VARCHAR(255) NOT NULL,
    country VARCHAR(255) NOT NULL,
    major VARCHAR(255) NOT NULL,
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    contact_email VARCHAR(255),
    status VARCHAR(50) DEFAULT 'studying',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_alumni_networks_location ON alumni_networks USING GIST (location);

-- 55. organizations
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    logo_url TEXT,
    website_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 56. certificate_templates
CREATE TABLE IF NOT EXISTS certificate_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 57. user_certificates
CREATE TABLE IF NOT EXISTS user_certificates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    template_id UUID REFERENCES certificate_templates(id) ON DELETE CASCADE,
    issued_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    verify_code VARCHAR(100) UNIQUE,
    qr_url TEXT,
    pdf_url TEXT,
    blockchain_metadata JSONB,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_user_certificates_user ON user_certificates(user_id);
CREATE INDEX IF NOT EXISTS idx_user_certificates_verify ON user_certificates(verify_code);

-- 58. user_preferences
CREATE TABLE IF NOT EXISTS user_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    language VARCHAR(20) DEFAULT 'vi',
    theme VARCHAR(20) DEFAULT 'dark',
    notifications_enabled BOOLEAN DEFAULT true,
    privacy_level VARCHAR(50) DEFAULT 'public',
    notification_settings TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_user_preferences_user ON user_preferences(user_id);

-- 59. scholarship_applications
CREATE TABLE IF NOT EXISTS scholarship_applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scholarship_id UUID REFERENCES scholarships(id) ON DELETE CASCADE,
    student_id UUID REFERENCES users(id) ON DELETE CASCADE,
    personal_statement TEXT,
    cv_url TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_scholarship_applications_student ON scholarship_applications(student_id);

-- 60. internship_applications
CREATE TABLE IF NOT EXISTS internship_applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    internship_id UUID REFERENCES internships(id) ON DELETE CASCADE,
    cover_letter TEXT,
    status VARCHAR(50) DEFAULT 'reviewing',
    tracking_id VARCHAR(100) UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 61. wifi_connections
CREATE TABLE IF NOT EXISTS wifi_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wifi_id UUID REFERENCES locations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    connected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    disconnected_at TIMESTAMP WITH TIME ZONE
);


-- 62. bookmarks (Saved/bookmarked items per user — internships & scholarships)
CREATE TABLE IF NOT EXISTS bookmarks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_type VARCHAR(50) NOT NULL,
    target_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_bookmarks_user_type_target UNIQUE (user_id, target_type, target_id)
);
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_type ON bookmarks(user_id, target_type);

-- User Events Analytics
CREATE TABLE IF NOT EXISTS user_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  event_type VARCHAR(100) NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ── Flood & Traffic tables (matching FloodZone/TrafficSegment/CivicReport entities) ──
-- PostGIS extension is enabled in infrastructure/postgres/docker-entrypoint-initdb.d/00-edumap-init.sh

CREATE TABLE IF NOT EXISTS flood_zones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    coordinates GEOMETRY(Polygon, 4326) NOT NULL,
    riskLevel VARCHAR(50) NOT NULL DEFAULT 'seasonal',
    metadata JSONB,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_flood_zones_coordinates ON flood_zones USING GIST (coordinates);

CREATE TABLE IF NOT EXISTS traffic_segments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "roadName" VARCHAR(100) NOT NULL,
    "roadType" VARCHAR(50) NOT NULL DEFAULT 'residential',
    coordinates GEOMETRY(LineString, 4326) NOT NULL,
    "freeFlowSpeed" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "congestionProfile" JSONB,
    "congestionLevel" INTEGER NOT NULL DEFAULT 0,
    "lastObserved" TIMESTAMP,
    "dataSource" VARCHAR(50) NOT NULL DEFAULT 'heuristic',
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_traffic_segments_coordinates ON traffic_segments USING GIST (coordinates);

-- ── Summer campaign tables ──
CREATE TABLE IF NOT EXISTS summer_campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    year INTEGER NOT NULL,
    location VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS summer_registrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    campaign_id UUID NOT NULL REFERENCES summer_campaigns(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_summer_reg_user_campaign UNIQUE (user_id, campaign_id)
);
CREATE INDEX IF NOT EXISTS idx_summer_reg_user ON summer_registrations(user_id);
CREATE INDEX IF NOT EXISTS idx_summer_reg_campaign ON summer_registrations(campaign_id);

CREATE TABLE IF NOT EXISTS summer_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES summer_campaigns(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    volunteer_count INTEGER NOT NULL,
    hours_spent DECIMAL(5,2) NOT NULL,
    date DATE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'completed',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ── Mobile unit tables (matches MobileUnit / MobileUnitRoute entities) ──
CREATE TABLE IF NOT EXISTS mobile_units (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    description TEXT,
    driver_name VARCHAR(255),
    contact_number VARCHAR(50),
    current_location GEOGRAPHY(Point, 4326),
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mobile_unit_routes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mobile_unit_id UUID NOT NULL REFERENCES mobile_units(id) ON DELETE CASCADE,
    destination_name VARCHAR(255) NOT NULL,
    location GEOGRAPHY(Point, 4326) NOT NULL,
    scheduled_at TIMESTAMP NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending'
);

-- ── HS Connection tables (matches UniversityCounseling, HsQuestion, HsAnswer, StudentConnection entities) ──
CREATE TABLE IF NOT EXISTS university_counseling (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    university_name VARCHAR(255) NOT NULL,
    program_info TEXT,
    contact_email VARCHAR(255),
    admission_criteria JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS hs_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES users(id),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    university_target VARCHAR(255),
    view_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_hs_questions_student ON hs_questions(student_id);

CREATE TABLE IF NOT EXISTS hs_answers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question_id UUID NOT NULL REFERENCES hs_questions(id) ON DELETE CASCADE,
    mentor_id UUID REFERENCES users(id),
    content TEXT NOT NULL,
    is_verified_answer BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_hs_answers_question ON hs_answers(question_id);

CREATE TABLE IF NOT EXISTS student_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requester_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_student_conn_req_recv UNIQUE (requester_id, receiver_id)
);
CREATE INDEX IF NOT EXISTS idx_student_conn_requester ON student_connections(requester_id);
CREATE INDEX IF NOT EXISTS idx_student_conn_receiver ON student_connections(receiver_id);

-- ── Business module tables ──
-- reviews (entity: Review — snake_case columns)
CREATE TABLE IF NOT EXISTS reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    service_id UUID REFERENCES business_services(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_reviews_user ON reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_service ON reviews(service_id);

-- cart_items (entity: CartItem — camelCase columns)
CREATE TABLE IF NOT EXISTS cart_items (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "productId" UUID REFERENCES products(id) ON DELETE CASCADE,
    "serviceId" UUID REFERENCES business_services(id) ON DELETE CASCADE,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_cart_items_user ON cart_items("userId");

-- orders (entity: Order — camelCase columns)
CREATE TABLE IF NOT EXISTS orders (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "currency" VARCHAR(10) DEFAULT 'VND',
    "status" VARCHAR(50) DEFAULT 'PENDING',
    "shippingAddress" TEXT,
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders("userId");

-- order_items (entity: OrderItem — camelCase columns)
CREATE TABLE IF NOT EXISTS order_items (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "orderId" UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    "productId" UUID REFERENCES products(id),
    "serviceId" UUID REFERENCES business_services(id),
    "quantity" INTEGER NOT NULL,
    "priceAtPurchase" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items("orderId");

-- business_transactions (entity: Transaction — camelCase columns)
CREATE TABLE IF NOT EXISTS business_transactions (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "orderId" UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    "paymentMethod" VARCHAR(50) DEFAULT 'COD',
    "status" VARCHAR(50) DEFAULT 'PENDING',
    "amount" DECIMAL(10,2) NOT NULL,
    "externalTransactionId" VARCHAR(255),
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_business_transactions_order ON business_transactions("orderId");

-- ============================================================================
-- EduMap Database Schema - Part 9: Previously Missing Tables
-- These tables have TypeORM entities but were absent from schema.sql, causing
-- 500 errors on API routes that query them.
-- ============================================================================

-- hackathons
CREATE TABLE IF NOT EXISTS hackathons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(50) DEFAULT 'upcoming',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_hackathons_dates ON hackathons(start_date, end_date);

-- hackathon_teams
CREATE TABLE IF NOT EXISTS hackathon_teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_name VARCHAR(255) NOT NULL,
    hackathon_id UUID NOT NULL REFERENCES hackathons(id) ON DELETE CASCADE,
    leader_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    members TEXT[] DEFAULT '{}',
    repo_url TEXT,
    demo_video TEXT,
    status VARCHAR(50) DEFAULT 'registered',
    score DECIMAL(5,2),
    feedback TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_hackathon_teams_hackathon ON hackathon_teams(hackathon_id);
CREATE INDEX IF NOT EXISTS idx_hackathon_teams_leader ON hackathon_teams(leader_id);

-- crawl_history
CREATE TABLE IF NOT EXISTS crawl_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    crawl_type VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL,
    records_added INTEGER DEFAULT 0,
    records_updated INTEGER DEFAULT 0,
    records_deleted INTEGER DEFAULT 0,
    errors INTEGER DEFAULT 0,
    error_message TEXT,
    duration_seconds INTEGER,
    triggered_by VARCHAR(255),
    is_automatic BOOLEAN DEFAULT FALSE,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_crawl_history_type ON crawl_history(crawl_type);

-- password_reset_tokens
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    token VARCHAR(255) NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user ON password_reset_tokens(user_id);

-- user_files
CREATE TABLE IF NOT EXISTS user_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    original_name VARCHAR(255) NOT NULL,
    file_url TEXT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    size_kb FLOAT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_user_files_user ON user_files(user_id);

-- admin_stats
CREATE TABLE IF NOT EXISTS admin_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    total_users INTEGER DEFAULT 0,
    active_users INTEGER DEFAULT 0,
    total_map_points INTEGER DEFAULT 0,
    total_learning_materials INTEGER DEFAULT 0,
    total_events INTEGER DEFAULT 0,
    total_posts INTEGER DEFAULT 0,
    total_donations INTEGER DEFAULT 0,
    total_certificates INTEGER DEFAULT 0,
    pending_approvals INTEGER DEFAULT 0,
    new_users_today INTEGER DEFAULT 0,
    new_users_this_week INTEGER DEFAULT 0,
    new_users_this_month INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- learning_spots (study spaces: cafe, library, study_space)
CREATE TABLE IF NOT EXISTS learning_spots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    location GEOGRAPHY(POINT, 4326),
    type VARCHAR(50), -- cafe, library, study_space
    has_wifi BOOLEAN DEFAULT TRUE,
    has_power_outlets BOOLEAN DEFAULT TRUE,
    rating_avg DECIMAL(3,2) DEFAULT 0,
    total_capacity INTEGER DEFAULT 50,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_learning_spots_location ON learning_spots USING GIST(location);

-- educational_points (schools, libraries, wifi, labs — GeoJSON-compatible)
CREATE TABLE IF NOT EXISTS educational_points (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50) NOT NULL, -- school, library, wifi, lab
    location GEOGRAPHY(POINT, 4326),
    address TEXT,
    is_verified BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_educational_points_location ON educational_points USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_educational_points_type ON educational_points(type);

-- mentor_availabilities
CREATE TABLE IF NOT EXISTS mentor_availabilities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mentor_id UUID NOT NULL REFERENCES mentors(user_id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL, -- 0-6 (Sunday-Saturday)
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_mentor_availabilities_mentor ON mentor_availabilities(mentor_id);

-- mentor_relationships (link mentors with mentees)
CREATE TABLE IF NOT EXISTS mentor_relationships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mentor_id UUID NOT NULL REFERENCES mentors(user_id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'active', -- active/inactive
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_mentor_relationships_unique ON mentor_relationships(mentor_id, student_id);

-- mentor_sessions (completed or ongoing mentoring sessions)
CREATE TABLE IF NOT EXISTS mentor_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mentor_id UUID REFERENCES mentors(user_id) ON DELETE SET NULL,
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    slot_start TIMESTAMP NOT NULL,
    slot_end TIMESTAMP NOT NULL,
    status VARCHAR(50) DEFAULT 'pending', -- pending/confirmed/completed/cancelled
    meeting_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_mentor_sessions_mentor ON mentor_sessions(mentor_id);
CREATE INDEX IF NOT EXISTS idx_mentor_sessions_student ON mentor_sessions(student_id);

-- volunteer_hours (logged volunteer hours per user)
CREATE TABLE IF NOT EXISTS volunteer_hours (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    hours INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_volunteer_hours_user ON volunteer_hours(user_id);

-- user_management (audit trail for admin actions on users)
CREATE TABLE IF NOT EXISTS user_management (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action_type VARCHAR(50) NOT NULL,
    performed_by UUID NOT NULL REFERENCES users(id),
    reason TEXT,
    old_status VARCHAR(50),
    new_status VARCHAR(50),
    old_role INTEGER,
    new_role INTEGER,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_user_management_user ON user_management(user_id);
