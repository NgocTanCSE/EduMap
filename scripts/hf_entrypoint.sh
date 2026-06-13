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
if [ ! -s "$PGDATA/PG_VERSION" ]; then
    echo "🆕 [PostgreSQL] Initializing database..."
    /usr/lib/postgresql/14/bin/initdb -D $PGDATA --encoding=UTF8 --locale=C || { echo "❌ [PostgreSQL] initdb failed!"; exit 1; }
    echo "✅ [PostgreSQL] initdb completed."
    
    echo "➡️ [PostgreSQL] Configuring to use /tmp for sockets..."
    echo "unix_socket_directories = '/tmp'" >> $PGDATA/postgresql.conf
    echo "✅ [PostgreSQL] Configuration updated."
    
    echo "➡️ [PostgreSQL] Starting temporarily for setup..."
    /usr/lib/postgresql/14/bin/pg_ctl -D $PGDATA -l /data/pg_start.log start || { cat /data/pg_start.log; echo "❌ [PostgreSQL] Temporary start failed!"; exit 1; }
    echo "✅ [PostgreSQL] Temporary start successful."
    
    echo "⏳ [PostgreSQL] Waiting for temporary PostgreSQL to start..."
    for i in $(seq 1 30); do
        if pg_isready -h /tmp -q; then break; fi
        echo "  Attempt $i/30: Waiting for PostgreSQL..."
        sleep 1
    done
    if ! pg_isready -h /tmp -q; then echo "❌ [PostgreSQL] Temporary PostgreSQL did not start in time!"; exit 1; fi
    echo "✅ [PostgreSQL] Temporary PostgreSQL is ready."
    
    echo "➡️ [PostgreSQL] Creating user 'admin' and database 'edumap_db'..."
    psql -h /tmp postgres -c "CREATE USER admin WITH SUPERUSER PASSWORD 'password123';" || { echo "❌ [PostgreSQL] User creation failed!"; exit 1; }
    createdb -h /tmp -O admin edumap_db || { echo "❌ [PostgreSQL] Database creation failed!"; exit 1; }
    echo "✅ [PostgreSQL] User and database created."
    
    echo "➡️ [PostgreSQL] Stopping temporary instance..."
    /usr/lib/postgresql/14/bin/pg_ctl -D $PGDATA stop || { echo "❌ [PostgreSQL] Temporary stop failed!"; exit 1; }
    echo "✅ [PostgreSQL] Temporary instance stopped."
else
    echo "🔄 [PostgreSQL] Database already initialized at $PGDATA. Skipping initdb."
fi

echo "🐘 Starting PostgreSQL service in background..."
/usr/lib/postgresql/14/bin/postgres -D $PGDATA > /data/pg.log 2>&1 &
echo "✅ PostgreSQL service started."

# --- Redis Setup ---
echo "--- Step 2: Redis Setup ---"
echo "🏮 Starting Redis service in background..."
redis-server --dir $REDIS_DIR --daemonize yes
echo "✅ Redis service started."

# --- Waiting for services ---
echo "--- Step 3: Waiting for services to be ready ---"
echo "⏳ Waiting for PostgreSQL to accept connections..."
for i in $(seq 1 30); do
    if pg_isready -h 127.0.0.1 -q; then
        echo "✅ PostgreSQL is ready!"
        break
    fi
    echo "  Attempt $i/30: Waiting for PostgreSQL..."
    sleep 1
done
if ! pg_isready -h 127.0.0.1 -q; then echo "❌ PostgreSQL did not become ready in time!"; exit 1; fi

echo "⏳ Waiting for Redis to accept connections..."
for i in $(seq 1 30); do
    if redis-cli ping 2>/dev/null | grep -q PONG; then
        echo "✅ Redis is ready!"
        break
    fi
    echo "  Attempt $i/30: Waiting for Redis..."
    sleep 1
done
if ! redis-cli ping 2>/dev/null | grep -q PONG; then echo "❌ Redis did not become ready in time!"; exit 1; fi

# --- Database Seeding and AI Knowledge Base Setup ---
echo "--- Step 4: Database Seeding and AI Knowledge Base Setup ---"
INIT_FLAG="/data/.initialized"

if [ ! -f "$INIT_FLAG" ]; then
    echo "🆕 First run detected. Initiating database and AI knowledge base seeding..."
    
    # Run Database Setup (Schema + Seeds)
    echo "➡️ Running Python script for database schema and initial data seeding (execute_db_setup.py)..."
    python3 -u scripts/execute_db_setup.py 2>&1 | tee /data/db_setup.log || { echo "❌ Database setup failed! Check /data/db_setup.log"; exit 1; }
    echo "✅ Database schema and initial data seeding completed."
    
    # Run AI Vector DB Seeding
    echo "➡️ Running Python script for AI Vector Database seeding (seed_vector_db.py)..."
    (cd ai-service && python3 -u seed_vector_db.py) 2>&1 | tee /data/ai_seed.log || { echo "❌ AI Vector DB seeding failed! Check /data/ai_seed.log"; exit 1; }
    echo "✅ AI Vector Database seeding completed."
    
    # Create Flag File
    touch "$INIT_FLAG" || { echo "❌ Failed to create initialization flag file!"; exit 1; }
    echo "✅ Initialization flag created: $INIT_FLAG."
else
    echo "🔄 System already initialized. Skipping database and AI knowledge base setup."
fi

echo "🏁 Handing over to Supervisor to start application services..."
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
