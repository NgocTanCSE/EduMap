#!/bin/bash
set -e

echo "===== Application Startup at $(date '+%Y-%m-%d %H:%M:%S') ====="

echo "🚀 Starting EduMap Initialization for Hugging Face Spaces..."

# 1. Start Postgres and Redis in background for initialization
echo "🐘 Starting PostgreSQL service..."
service postgresql start

echo "🏮 Starting Redis service..."
service redis-server start

# 2. Wait for services to be truly ready (not just started)
echo "⏳ Waiting for PostgreSQL to accept connections..."
for i in $(seq 1 30); do
    if su - postgres -c "pg_isready -q" 2>/dev/null; then
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

# 3. Check if Database is initialized
INIT_FLAG="/data/.initialized"

if [ ! -f "$INIT_FLAG" ]; then
    echo "🆕 First run detected. Initializing databases and AI knowledge..."
    
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

# 4. PostgreSQL and Redis stay running as system services.
#    Supervisord only manages application processes (backend, frontend, ai-service, minio, nginx).
echo "🏁 Handing over to Supervisor..."
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
