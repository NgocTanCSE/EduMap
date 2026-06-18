-- Phase 1: Database Optimization & Soft Delete Support

-- 1. Add Soft Delete support (deleted_at) to essential tables
ALTER TABLE roles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE permissions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE map_categories ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE mentors ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE business_services ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE user_skills ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE scholarships ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active';
ALTER TABLE education_stats ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- 2. Performance Indexes (B-TREE & GIST)

-- Index for searching users by name and status
CREATE INDEX IF NOT EXISTS idx_users_full_name ON users(full_name);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role_id);

-- Index for filtering map points
CREATE INDEX IF NOT EXISTS idx_map_points_status ON map_points(status);
CREATE INDEX IF NOT EXISTS idx_map_points_city ON map_points(city);
CREATE INDEX IF NOT EXISTS idx_map_points_province ON map_points(province);

-- Index for learning materials
CREATE INDEX IF NOT EXISTS idx_materials_status ON learning_materials(status);
CREATE INDEX IF NOT EXISTS idx_materials_type ON learning_materials(type);
CREATE INDEX IF NOT EXISTS idx_materials_subject ON learning_materials(subject);

-- Index for events and opportunities
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
CREATE INDEX IF NOT EXISTS idx_opportunities_status ON opportunities(status);
CREATE INDEX IF NOT EXISTS idx_opportunities_type ON opportunities(type);

-- Index for marketplace
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_services_category ON business_services(category);

-- 3. Referential Integrity Fixes (Missing FKs or Constraints)
-- Ensure consistency in role_permissions
ALTER TABLE role_permissions DROP CONSTRAINT IF EXISTS role_permissions_role_id_fkey;
ALTER TABLE role_permissions ADD CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE;

-- Ensure consistency in user_badges
ALTER TABLE user_badges DROP CONSTRAINT IF EXISTS user_badges_user_id_fkey;
ALTER TABLE user_badges ADD CONSTRAINT user_badges_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- 4. Audit Log Optimization
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_action ON audit_logs(user_id, action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- 5. Payment & Booking Enhancements
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'unpaid';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS transaction_id UUID;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS amount DECIMAL(15, 2) DEFAULT 0;
