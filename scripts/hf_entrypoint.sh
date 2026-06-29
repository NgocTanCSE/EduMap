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

# --- PostgreSQL Setup ---
echo "--- Step 1: PostgreSQL Setup ---"
echo "🐘 Starting PostgreSQL service in background..."
/usr/lib/postgresql/14/bin/postgres -D $PGDATA > /data/pg.log 2>&1 &
PG_PID=$!
echo "✅ PostgreSQL service started (PID: $PG_PID)."

# Wait for PostgreSQL with extended timeout
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
    echo "❌ PostgreSQL did not become ready in time!"
    cat /data/pg.log 2>/dev/null || true
    exit 1
fi

# Initialize database if needed
INIT_FLAG="/data/.initialized"
if [ ! -f "$INIT_FLAG" ]; then
    echo "🆕 First run detected. Initiating database and AI knowledge base seeding..."
    
    # Run Database Setup
    echo "➡️ Running database schema and seeding..."
    timeout 300 python3 -u scripts/execute_db_setup.py 2>&1 | tee /data/db_setup.log || { echo "⚠️ Database setup timed out or failed, continuing..."; }
    
    # Run AI Vector DB Seeding (skip if no API key)
    if [ -n "$GEMINI_API_KEY" ]; then
        echo "➡️ Running AI Vector Database seeding..."
        timeout 60 python3 -u ai-service/seed_vector_db.py 2>&1 | tee /data/ai_seed.log || echo "⚠️ AI seed skipped or timed out"
    else
        echo "⚠️ Skipping AI Vector DB seeding (GEMINI_API_KEY not set)"
    fi
    
    touch "$INIT_FLAG"
    echo "✅ Initialization completed."
else
    echo "🔄 System already initialized. Skipping database setup."
fi

# --- Redis Setup ---
echo "--- Step 2: Redis Setup ---"
echo "🏮 Starting Redis service in background..."
redis-server --dir $REDIS_DIR --daemonize yes
echo "✅ Redis service started."

# Wait for Redis
for i in $(seq 1 30); do
    if redis-cli ping 2>/dev/null | grep -q PONG; then
        echo "✅ Redis is ready!"
        break
    fi
    echo "  Attempt $i/30: Waiting for Redis..."
    sleep 1
done

echo "🏁 Handing over to Supervisor to start application services..."
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
