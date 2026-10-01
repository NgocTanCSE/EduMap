#!/bin/bash
set -e

echo "===== Application Startup at $(date '+%Y-%m-%d %H:%M:%S') ====="
echo "🚀 Starting EduMap Initialization for Hugging Face Spaces..."

# Configure paths
export PGDATA=/data/pgdata
export REDIS_DIR=/data/redis
export MINIO_DATA_DIR=/data/minio_data
export CHROMA_DB_DIR=/data/chroma_db

mkdir -p $PGDATA $REDIS_DIR $MINIO_DATA_DIR $CHROMA_DB_DIR

# --- Resolve DB credentials from environment (HF Spaces Secrets win; safe defaults otherwise) ---
# This MUST stay in sync with backend env (supervisord) and data-source.ts defaults,
# otherwise the backend/seed connects with a different password than the Postgres user.
export DB_USERNAME="${DB_USERNAME:-admin}"
export DB_DATABASE="${DB_DATABASE:-edumap_db}"
export DB_PASSWORD="${DB_PASSWORD:-password123}"


# --- PostgreSQL Setup ---
echo "--- Step 1: PostgreSQL Setup ---"
if [ ! -s "$PGDATA/PG_VERSION" ]; then
    echo "🆕 Initializing PostgreSQL database..."
    /usr/lib/postgresql/14/bin/initdb -D $PGDATA --encoding=UTF8 --locale=C || { echo "❌ initdb failed!"; exit 1; }
    echo "unix_socket_directories = '/tmp'" >> $PGDATA/postgresql.conf
    echo "✅ initdb completed."
else
    echo "🔄 Database already initialized."
fi

echo "🐘 Starting PostgreSQL..."
/usr/lib/postgresql/14/bin/postgres -D $PGDATA > /data/pg.log 2>&1 &
PG_PID=$!
echo "✅ PostgreSQL started (PID: $PG_PID)."

# Wait for PostgreSQL with timeout
echo "⏳ Waiting for PostgreSQL to accept connections..."
for i in $(seq 1 60); do
    if pg_isready -h 127.0.0.1 -q 2>/dev/null; then
        echo "✅ PostgreSQL is ready!"
        break
    fi
    echo "  Attempt $i/60: Waiting for PostgreSQL..."
    sleep 1
done

if ! pg_isready -h 127.0.0.1 -q 2>/dev/null; then
    echo "❌ PostgreSQL did not start in time!"
    cat /data/pg.log 2>/dev/null || true
    exit 1
fi

# Create user and database (password driven by DB_PASSWORD secret/default)
psql -h 127.0.0.1 postgres -c "CREATE USER ${DB_USERNAME} WITH SUPERUSER PASSWORD '${DB_PASSWORD}';" 2>/dev/null || true
psql -h 127.0.0.1 postgres -c "CREATE DATABASE ${DB_DATABASE} OWNER ${DB_USERNAME};" 2>/dev/null || true
echo "✅ User and database ready."

# Apply schema updates and ensure missing tables exist
if [ -f "backend/src/database/phase1_updates.sql" ]; then
    echo "🔄 Applying phase1_updates.sql schema updates..."
    PGPASSWORD="${DB_PASSWORD}" psql -h 127.0.0.1 -U "${DB_USERNAME}" -d "${DB_DATABASE}" -f backend/src/database/phase1_updates.sql 2>/dev/null || true
    echo "✅ Schema updates applied."
fi

# --- Redis Setup ---
echo "--- Step 2: Redis Setup ---"
redis-server --dir $REDIS_DIR --daemonize yes
sleep 2
echo "✅ Redis started."

# Wait for Redis
for i in $(seq 1 30); do
    if redis-cli ping 2>/dev/null | grep -q PONG; then
        echo "✅ Redis is ready!"
        break
    fi
    echo "  Attempt $i/30: Waiting for Redis..."
    sleep 1
done

# --- Database Seeding ---
echo "--- Step 3: Database Seeding ---"
INIT_FLAG="/data/.initialized"

if [ ! -f "$INIT_FLAG" ]; then
    echo "🆕 First run - seeding database..."
    timeout 300 python3 -u scripts/execute_db_setup.py 2>&1 | tee /data/db_setup.log || echo "⚠️ Database setup timed out or had errors"
    touch "$INIT_FLAG"
    echo "✅ Initialization completed."
else
    echo "🔄 Database already initialized."
fi

echo "🏁 Handing over to Supervisor to start application services..."
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
