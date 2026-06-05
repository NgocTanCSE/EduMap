#!/bin/bash
set -e

echo "🚀 Starting EduMap Initialization for Hugging Face Spaces..."

# 1. Start Postgres and Redis in background for initialization
echo "🐘 Starting PostgreSQL service..."
service postgresql start

echo "🏮 Starting Redis service..."
service redis-server start

# Wait for services to be ready
sleep 5

# 2. Check if Database is initialized
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

# 3. Stop temporary background services so Supervisor can manage them
echo "🛑 Stopping temporary services..."
service postgresql stop
service redis-server stop

# 4. Start Supervisord to manage all processes
echo "🏁 Handing over to Supervisor..."
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
