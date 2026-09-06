#!/bin/bash
set -e

echo "===== Application Startup at $(date '+%Y-%m-%d %H:%M:%S') ====="
echo "🚀 Starting EduMap Initialization for Hugging Face Spaces..."

# Configure paths
export PGDATA=/data/pgdata
export REDIS_DIR=/data/redis
export MINIO_DATA_DIR=/data/minio_data
export CHROMA_DB_DIR=/data/chroma_db
export OSRM_DATA_DIR=/data/osrm

mkdir -p $PGDATA $REDIS_DIR $MINIO_DATA_DIR $CHROMA_DB_DIR $OSRM_DATA_DIR

# --- OSRM Setup ---
echo "--- Step 0: OSRM Setup ---"
OSRM_FILE="$OSRM_DATA_DIR/vietnam-latest.osrm"
OSRM_PBF="$OSRM_DATA_DIR/vietnam-latest.osm.pbf"

if [ ! -f "$OSRM_FILE" ]; then
    echo "🆕 OSRM data not found, downloading and preprocessing..."
    
    # Download Vietnam OSM data if not exists
    if [ ! -f "$OSRM_PBF" ]; then
        echo "📥 Downloading Vietnam OSM data (~50MB)..."
        wget -q --show-progress "https://download.geofabrik.de/asia/vietnam-latest.osm.pbf" -O "$OSRM_PBF" \
            || { echo "❌ Failed to download OSM data"; exit 1; }
        echo "✅ OSM data downloaded."
    fi
    
    echo "⚙️  Preprocessing OSM data for OSRM (this may take a few minutes)..."
    osrm-extract -p /usr/local/share/osrm/profiles/car.lua "$OSRM_PBF" \
        && osrm-partition "$OSRM_FILE" \
        && osrm-customize "$OSRM_FILE" \
        && echo "✅ OSRM preprocessing complete." \
        || { echo "❌ OSRM preprocessing failed"; exit 1; }
else
    echo "🔄 OSRM data already preprocessed."
fi

echo "🛣️  Starting OSRM server..."
osrm-routed --algorithm mld "$OSRM_FILE" > /data/osrm.log 2>&1 &
OSRM_PID=$!
echo "✅ OSRM started (PID: $OSRM_PID)."

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

# Create user and database
psql -h 127.0.0.1 postgres -c "CREATE USER admin WITH SUPERUSER PASSWORD 'password123';" 2>/dev/null || true
createdb -h 127.0.0.1 -O admin edumap_db 2>/dev/null || true
echo "✅ User and database ready."

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
