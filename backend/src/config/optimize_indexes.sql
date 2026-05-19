-- Toi uu hoa tim kiem theo Email va Role
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Toi uu hoa tim kiem khong gian (PostGIS GIST Index)
CREATE INDEX IF NOT EXISTS idx_edu_points_location ON educational_points USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_internships_location ON internships USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_stem_labs_location ON stem_labs USING GIST (location);

-- Toi uu hoa tim kiem theo thoi gian cho Audit Logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
