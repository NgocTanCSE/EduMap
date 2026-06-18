-- =====================================================
-- EduMap Analytics Setup - Complete Migration
-- =====================================================

-- 1. USER EVENTS TABLE (core analytics tracking)
CREATE TABLE IF NOT EXISTS user_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    event_type VARCHAR(255) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for user_events
CREATE INDEX IF NOT EXISTS idx_user_events_type ON user_events(event_type);
CREATE INDEX IF NOT EXISTS idx_user_events_user ON user_events(user_id);
CREATE INDEX IF NOT EXISTS idx_user_events_created_at ON user_events(created_at);
CREATE INDEX IF NOT EXISTS idx_user_events_user_type ON user_events(user_id, event_type);
CREATE INDEX IF NOT EXISTS idx_user_events_created_type ON user_events(created_at, event_type);

-- =====================================================
-- 2. AUTO-UPDATE TRIGGERS
-- =====================================================

-- Function to automatically update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to all tables with updated_at column
DO $$
DECLARE
    t RECORD;
BEGIN
    FOR t IN
        SELECT table_name
        FROM information_schema.columns
        WHERE column_name = 'updated_at'
        AND table_schema = 'public'
        AND table_name != 'user_events'
    LOOP
        EXECUTE format(
            'CREATE TRIGGER update_%s_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()',
            t.table_name, t.table_name
        );
    END LOOP;
END $$;

-- =====================================================
-- 3. MATERIALIZED VIEWS FOR DASHBOARD
-- =====================================================

-- Daily Active Users (DAU)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_daily_active_users AS
SELECT
    DATE(created_at) AS activity_date,
    COUNT(DISTINCT user_id) AS active_users,
    COUNT(*) AS total_events
FROM user_events
WHERE user_id IS NOT NULL
GROUP BY DATE(created_at)
ORDER BY activity_date DESC;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_dau_date ON mv_daily_active_users(activity_date);

-- Monthly Active Users (MAU)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_monthly_active_users AS
SELECT
    DATE_TRUNC('month', created_at) AS activity_month,
    COUNT(DISTINCT user_id) AS active_users,
    COUNT(*) AS total_events
FROM user_events
WHERE user_id IS NOT NULL
GROUP BY DATE_TRUNC('month', created_at)
ORDER BY activity_month DESC;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_mau_month ON mv_monthly_active_users(activity_month);

-- Popular Pages
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_popular_pages AS
SELECT
    metadata->>'page' AS page_url,
    COUNT(*) AS view_count,
    COUNT(DISTINCT user_id) AS unique_visitors,
    AVG((metadata->>'duration')::INTEGER) AS avg_duration_seconds
FROM user_events
WHERE event_type = 'page_view'
AND metadata->>'page' IS NOT NULL
GROUP BY metadata->>'page'
ORDER BY view_count DESC;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_popular_pages_url ON mv_popular_pages(page_url);

-- Event Type Statistics
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_event_type_stats AS
SELECT
    event_type,
    COUNT(*) AS total_count,
    COUNT(DISTINCT user_id) AS unique_users,
    DATE_TRUNC('day', MIN(created_at)) AS first_seen,
    DATE_TRUNC('day', MAX(created_at)) AS last_seen
FROM user_events
GROUP BY event_type
ORDER BY total_count DESC;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_event_type ON mv_event_type_stats(event_type);

-- Device Statistics
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_device_stats AS
SELECT
    metadata->>'device' AS device_type,
    COUNT(*) AS total_sessions,
    COUNT(DISTINCT user_id) AS unique_users,
    AVG((metadata->>'duration')::INTEGER) AS avg_session_duration
FROM user_events
WHERE metadata->>'device' IS NOT NULL
GROUP BY metadata->>'device'
ORDER BY total_sessions DESC;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_device_type ON mv_device_stats(device_type);

-- =====================================================
-- 4. STORED PROCEDURES
-- =====================================================

-- Refresh all materialized views
CREATE OR REPLACE PROCEDURE refresh_analytics_views()
LANGUAGE plpgsql AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_active_users;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_monthly_active_users;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_popular_pages;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_event_type_stats;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_device_stats;
    RAISE NOTICE 'All analytics materialized views refreshed successfully';
END $$;

-- Get daily active users for a date range
CREATE OR REPLACE FUNCTION get_daily_active_users(
    start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
    end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE(activity_date DATE, active_users BIGINT, total_events BIGINT)
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT
        DATE(ue.created_at) AS activity_date,
        COUNT(DISTINCT ue.user_id) AS active_users,
        COUNT(*)::BIGINT AS total_events
    FROM user_events ue
    WHERE DATE(ue.created_at) BETWEEN start_date AND end_date
    AND ue.user_id IS NOT NULL
    GROUP BY DATE(ue.created_at)
    ORDER BY activity_date;
END $$;

-- Get user retention rate (users who returned after N days)
CREATE OR REPLACE FUNCTION get_user_retention(
    cohort_date DATE,
    days_after INTEGER DEFAULT 7
)
RETURNS TABLE(retention_rate DECIMAL(5,2))
LANGUAGE plpgsql AS $$
DECLARE
    cohort_users BIGINT;
    retained_users BIGINT;
BEGIN
    -- Count users active on cohort date
    SELECT COUNT(DISTINCT user_id) INTO cohort_users
    FROM user_events
    WHERE DATE(created_at) = cohort_date
    AND user_id IS NOT NULL;

    -- Count users from cohort who returned after N days
    SELECT COUNT(DISTINCT ue.user_id) INTO retained_users
    FROM user_events ue
    WHERE DATE(ue.created_at) = cohort_date + days_after
    AND ue.user_id IN (
        SELECT DISTINCT user_id
        FROM user_events
        WHERE DATE(created_at) = cohort_date
        AND user_id IS NOT NULL
    );

    IF cohort_users = 0 THEN
        retention_rate := 0;
    ELSE
        retention_rate := (retained_users::DECIMAL / cohort_users::DECIMAL) * 100;
    END IF;

    RETURN NEXT;
END $$;

-- Get popular pages with trends
CREATE OR REPLACE FUNCTION get_popular_pages_with_trends(
    days_back INTEGER DEFAULT 7
)
RETURNS TABLE(
    page_url TEXT,
    current_views BIGINT,
    previous_views BIGINT,
    growth_rate DECIMAL(10,2)
)
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    WITH current_period AS (
        SELECT
            metadata->>'page' AS page,
            COUNT(*) AS views
        FROM user_events
        WHERE event_type = 'page_view'
        AND DATE(created_at) BETWEEN CURRENT_DATE - days_back AND CURRENT_DATE
        AND metadata->>'page' IS NOT NULL
        GROUP BY metadata->>'page'
    ),
    previous_period AS (
        SELECT
            metadata->>'page' AS page,
            COUNT(*) AS views
        FROM user_events
        WHERE event_type = 'page_view'
        AND DATE(created_at) BETWEEN CURRENT_DATE - (days_back * 2) AND CURRENT_DATE - days_back
        AND metadata->>'page' IS NOT NULL
        GROUP BY metadata->>'page'
    )
    SELECT
        cp.page::TEXT AS page_url,
        cp.views AS current_views,
        COALESCE(pp.views, 0) AS previous_views,
        CASE
            WHEN COALESCE(pp.views, 0) = 0 THEN 100.00
            ELSE ((cp.views - pp.views)::DECIMAL / pp.views::DECIMAL) * 100
        END AS growth_rate
    FROM current_period cp
    LEFT JOIN previous_period pp ON cp.page = pp.page
    ORDER BY cp.views DESC;
END $$;

-- =====================================================
-- 5. TRIGGERS FOR AUTO-TRACKING
-- =====================================================

-- Auto-track user login events
CREATE OR REPLACE FUNCTION track_user_login()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.last_login_at IS DISTINCT FROM OLD.last_login_at THEN
        INSERT INTO user_events (user_id, event_type, metadata)
        VALUES (
            NEW.id,
            'user_login',
            jsonb_build_object(
                'email', NEW.email,
                'provider', NEW.provider,
                'ip', NULL
            )
        );
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply login tracking trigger to users table
DROP TRIGGER IF EXISTS track_user_login_trigger ON users;
CREATE TRIGGER track_user_login_trigger
    AFTER UPDATE OF last_login_at ON users
    FOR EACH ROW
    EXECUTE FUNCTION track_user_login();

-- =====================================================
-- 6. CLEANUP PROCEDURE (for old events)
-- =====================================================

CREATE OR REPLACE PROCEDURE cleanup_old_events(retention_days INTEGER DEFAULT 90)
LANGUAGE plpgsql AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM user_events
    WHERE created_at < CURRENT_TIMESTAMP - (retention_days || ' days')::INTERVAL;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Cleaned up % old analytics events (older than % days)', deleted_count, retention_days;
END $$;

-- =====================================================
-- 7. SEED DATA FOR ANALYTICS
-- =====================================================

-- Insert sample user events for testing
INSERT INTO user_events (user_id, event_type, metadata, created_at)
SELECT
    (SELECT id FROM users LIMIT 1),
    event_type,
    metadata::JSONB,
    created_at
FROM (VALUES
    ('page_view', '{"page": "/dashboard", "duration": 120, "device": "desktop"}', CURRENT_TIMESTAMP - INTERVAL '1 day'),
    ('page_view', '{"page": "/map", "duration": 180, "device": "mobile"}', CURRENT_TIMESTAMP - INTERVAL '1 day'),
    ('page_view', '{"page": "/career", "duration": 90, "device": "tablet"}', CURRENT_TIMESTAMP - INTERVAL '2 days'),
    ('click_career', '{"page": "/career", "duration": 30, "device": "desktop"}', CURRENT_TIMESTAMP - INTERVAL '2 days'),
    ('mentor_booking', '{"page": "/mentor", "duration": 60, "device": "mobile"}', CURRENT_TIMESTAMP - INTERVAL '3 days'),
    ('search_scholarship', '{"page": "/scholarships", "duration": 150, "device": "desktop"}', CURRENT_TIMESTAMP - INTERVAL '3 days'),
    ('apply_internship', '{"page": "/internships", "duration": 200, "device": "tablet"}', CURRENT_TIMESTAMP - INTERVAL '4 days'),
    ('page_view', '{"page": "/community", "duration": 240, "device": "desktop"}', CURRENT_TIMESTAMP - INTERVAL '4 days'),
    ('view_ai_trends', '{"page": "/analytics/trends", "duration": 300, "device": "mobile"}', CURRENT_TIMESTAMP - INTERVAL '5 days'),
    ('page_view', '{"page": "/library", "duration": 180, "device": "desktop"}', CURRENT_TIMESTAMP - INTERVAL '5 days')
) AS events(event_type, metadata, created_at)
WHERE NOT EXISTS (SELECT 1 FROM user_events LIMIT 1);

-- Refresh materialized views
CALL refresh_analytics_views();
