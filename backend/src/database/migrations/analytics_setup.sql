-- Migration to create user_events table
CREATE TABLE IF NOT EXISTS user_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    event_type VARCHAR(255) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster querying
CREATE INDEX idx_user_events_type ON user_events(event_type);
CREATE INDEX idx_user_events_user ON user_events(user_id);
CREATE INDEX idx_user_events_created_at ON user_events(created_at);
