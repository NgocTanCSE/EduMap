#!/bin/bash
set -e

echo "===== Application Startup at $(date '+%Y-%m-%d %H:%M:%S') ====="

echo "🚀 Starting EduMap Initialization for Hugging Face Spaces..."

# Configure paths
export PGDATA=/data/pgdata
export REDIS_DIR=/data/redis

mkdir -p $PGDATA $REDIS_DIR /data/minio

# Initialize PostgreSQL if not initialized
if [ ! -s "$PGDATA/PG_VERSION" ]; then
    echo "🆕 Initializing PostgreSQL database..."
    /usr/lib/postgresql/14/bin/initdb -D $PGDATA
    
    echo "Starting PostgreSQL temporarily for setup..."
    /usr/lib/postgresql/14/bin/pg_ctl -D $PGDATA -l /data/pg_start.log start
    
    echo "Waiting for PostgreSQL to start..."
    for i in $(seq 1 30); do
        if pg_isready -q; then break; fi
        sleep 1
    done
    
    psql postgres -c "CREATE USER admin WITH SUPERUSER PASSWORD 'password123';"
    createdb -O admin edumap_db
    
    /usr/lib/postgresql/14/bin/pg_ctl -D $PGDATA stop
fi

echo "🐘 Starting PostgreSQL service..."
/usr/lib/postgresql/14/bin/postgres -D $PGDATA > /data/pg.log 2>&1 &

echo "🏮 Starting Redis service..."
redis-server --dir $REDIS_DIR --daemonize yes

# 2. Wait for services to be truly ready (not just started)
echo "⏳ Waiting for PostgreSQL to accept connections..."
for i in $(seq 1 30); do
    if pg_isready -q; then
        echo "✅ PostgreSQL is ready!"
        break
    fi
    echo "  Attempt $i/30..."
    sleep 1
done

echo "⏳ Waiting for Redis to accept connections..."
for i in $(seq 1 30); do
    if redis-cli ping 2>/dev/null | grep -q PONG; then
        echo "✅ Redis is ready!"
        break
    fi
    echo "  Attempt $i/30..."
    sleep 1
done

# 3. Check if Database is seeded
INIT_FLAG="/data/.initialized"

if [ ! -f "$INIT_FLAG" ]; then
    echo "🆕 First run detected. Seeding databases and AI knowledge..."
    
    # Run Database Setup (Schema + Seeds)
    echo "📦 Running Database Setup..."
    python3 scripts/execute_db_setup.py
    
    # Run AI Vector DB Seeding
    echo "🧠 Seeding AI Vector Database..."
    cd ai-service && python3 seed_vector_db.py && cd ..
    
    # Create Flag File
    touch "$INIT_FLAG"
    echo "✅ Initialization complete!"
else
    echo "🔄 System already initialized. Skipping setup."
fi

echo "🏁 Handing over to Supervisor..."
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
