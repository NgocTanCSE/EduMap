"""Add all columns that exist in SQLite but are missing in Supabase Postgres.

Idempotent: uses ALTER TABLE ... ADD COLUMN IF NOT EXISTS.
Run after create_missing_tables.py / migration:run.

Usage:
    DB_TYPE=postgres DB_HOST=... ... python3 scripts/add_missing_columns.py
"""
import os
import sys

try:
    import psycopg2
except ImportError:
    print("ERROR: psycopg2 not available")
    sys.exit(1)

MISSING = [
    ("borrow_requests", "updated_at", "TIMESTAMP"),
    ("business_profiles", "address", "TEXT"),
    ("career_paths", "resources", "JSONB"),
    ("certificates", "description", "TEXT"),
    ("certificates", "metadata", "JSONB"),
    ("comments", "deleted_at", "TIMESTAMP"),
    ("comments", "like_count", "INTEGER DEFAULT 0"),
    ("comments", "parent_id", "UUID"),
    ("comments", "status", "VARCHAR(50) DEFAULT 'active'"),
    ("comments", "updated_at", "TIMESTAMP"),
    ("donation_campaigns", "images", "JSONB"),
    ("donation_campaigns", "location_point", "GEOGRAPHY(POINT,4326)"),
    ("donation_campaigns", "organizer_id", "UUID"),
    ("donation_campaigns", "start_date", "TIMESTAMP"),
    ("donations", "currency", "VARCHAR(10) DEFAULT 'VND'"),
    ("donations", "is_anonymous", "BOOLEAN DEFAULT false"),
    ("donations", "payment_method", "VARCHAR(50)"),
    ("donations", "payment_status", "VARCHAR(50) DEFAULT 'completed'"),
    ("donations", "receipt_url", "TEXT"),
    ("event_registrations", "feedback_rating", "INTEGER"),
    ("event_registrations", "feedback_text", "TEXT"),
    ("events", "address", "TEXT"),
    ("events", "deleted_at", "TIMESTAMP"),
    ("events", "is_online", "BOOLEAN DEFAULT false"),
    ("events", "location_point", "GEOGRAPHY(POINT,4326)"),
    ("events", "meeting_url", "TEXT"),
    ("events", "tags", "JSONB"),
    ("features", "created_at", "TIMESTAMP NOT NULL DEFAULT now()"),
    ("green_activities", "carbon_saved_kg", "DOUBLE PRECISION DEFAULT 0"),
    ("green_activities", "challenge_id", "UUID"),
    ("green_activities", "points_earned", "INTEGER DEFAULT 0"),
    ("green_activities", "verified_at", "TIMESTAMP"),
    ("green_challenges", "end_date", "TIMESTAMP"),
    ("green_challenges", "participant_count", "INTEGER DEFAULT 0"),
    ("groups", "avatar_url", "TEXT"),
    ("groups", "cover_url", "TEXT"),
    ("groups", "deleted_at", "TIMESTAMP"),
    ("groups", "member_count", "INTEGER DEFAULT 0"),
    ("groups", "type", "VARCHAR(50) DEFAULT 'public'"),
    ("groups", "updated_at", "TIMESTAMP"),
    ("internships", "application_count", "INTEGER DEFAULT 0"),
    ("internships", "benefits", "TEXT"),
    ("internships", "duration", "VARCHAR(100)"),
    ("internships", "requirements", "TEXT"),
    ("learning_materials", "deleted_at", "TIMESTAMP"),
    ("learning_materials", "file_size", "VARCHAR(50)"),
    ("learning_materials", "is_offline_available", "BOOLEAN DEFAULT false"),
    ("learning_materials", "rating_avg", "DOUBLE PRECISION DEFAULT 0"),
    ("learning_materials", "search_vector", "TEXT"),
    ("learning_materials", "status", "VARCHAR(50) DEFAULT 'active'"),
    ("learning_materials", "thumbnail_url", "TEXT"),
    ("learning_spots", "address", "TEXT"),
    ("learning_spots", "amenities", "JSONB"),
    ("learning_spots", "description", "TEXT"),
    ("learning_spots", "last_updated", "TIMESTAMP"),
    ("learning_spots", "opening_hours", "TEXT"),
    ("learning_spots", "quietness", "DOUBLE PRECISION"),
    ("map_points", "is_fixed", "BOOLEAN DEFAULT false"),
    ("mentors", "availability_json", "JSONB"),
    ("mentors", "total_sessions", "INTEGER DEFAULT 0"),
    ("modules", "created_at", "TIMESTAMP NOT NULL DEFAULT now()"),
    ("opportunities", "benefits", "TEXT"),
    ("opportunities", "created_by", "UUID"),
    ("opportunities", "deleted_at", "TIMESTAMP"),
    ("opportunities", "field_tags", "JSONB"),
    ("opportunities", "organization", "VARCHAR(255)"),
    ("opportunities", "region", "VARCHAR(100)"),
    ("opportunities", "requirements", "TEXT"),
    ("opportunities", "status", "VARCHAR(50) DEFAULT 'active'"),
    ("opportunities", "url", "TEXT"),
    ("posts", "deleted_at", "TIMESTAMP"),
    ("posts", "pinned", "BOOLEAN DEFAULT false"),
    ("posts", "search_vector", "TEXT"),
    ("posts", "status", "VARCHAR(50) DEFAULT 'published'"),
    ("posts", "tags", "JSONB"),
    ("roles", "created_at", "TIMESTAMP NOT NULL DEFAULT now()"),
    ("roles", "display_name", "VARCHAR(255)"),
    ("roles", "level", "INTEGER DEFAULT 0"),
    ("roles", "system_created", "BOOLEAN DEFAULT false"),
    ("stem_labs", "photos", "JSONB"),
    ("stem_labs", "school_id", "UUID"),
    ("support_tickets", "assigned_to", "UUID"),
    ("support_tickets", "category", "VARCHAR(100)"),
    ("support_tickets", "resolved_at", "TIMESTAMP"),
    ("support_tickets", "user_id", "UUID"),
    ("surveys", "created_by", "UUID"),
    ("surveys", "description", "TEXT"),
    ("surveys", "end_date", "TIMESTAMP"),
    ("surveys", "response_count", "INTEGER DEFAULT 0"),
    ("surveys", "start_date", "TIMESTAMP"),
    ("surveys", "target_roles", "JSONB"),
    ("surveys", "updated_at", "TIMESTAMP"),
    ("user_learning_history", "action", "VARCHAR(100)"),
    ("user_learning_history", "created_at", "TIMESTAMP NOT NULL DEFAULT now()"),
    ("user_learning_history", "progress_pct", "DOUBLE PRECISION DEFAULT 0"),
    ("user_learning_history", "time_spent_sec", "INTEGER DEFAULT 0"),
    ("user_points", "source_id", "UUID"),
    ("users", "last_login_at", "TIMESTAMP"),
    ("users", "provider", "VARCHAR(50)"),
    ("users", "provider_id", "VARCHAR(255)"),
    ("volunteer_activities", "location_point", "GEOGRAPHY(POINT,4326)"),
    ("volunteer_activities", "proof_urls", "JSONB"),
    ("volunteer_activities", "verified_by", "UUID"),
    ("wifi_locations", "rating_avg", "DOUBLE PRECISION DEFAULT 0"),
]


def pg_conn():
    host = os.getenv("DB_HOST", "localhost")
    kwargs = dict(
        host=host,
        port=int(os.getenv("DB_PORT", "6543" if "supabase" in host else "5432")),
        user=os.getenv("DB_USERNAME", "postgres"),
        password=os.getenv("DB_PASSWORD", ""),
        dbname=os.getenv("DB_DATABASE", "postgres"),
    )
    if host not in ("localhost", "127.0.0.1"):
        kwargs["sslmode"] = os.getenv("DB_SSLMODE", "require")
    return psycopg2.connect(**kwargs)


def main():
    conn = pg_conn()
    cur = conn.cursor()
    ok = 0
    fail = 0
    for table, col, typ in MISSING:
        try:
            cur.execute(f'ALTER TABLE "{table}" ADD COLUMN IF NOT EXISTS "{col}" {typ}')
            conn.commit()
            ok += 1
        except Exception as e:
            conn.rollback()
            fail += 1
            print(f"  FAIL {table}.{col}: {e}")
    cur.close()
    conn.close()
    print(f"Done. Added/verified {ok} columns, {fail} failures.")


if __name__ == "__main__":
    main()