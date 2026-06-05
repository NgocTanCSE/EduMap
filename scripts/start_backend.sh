#!/bin/bash
# Backend Wrapper Script - runs backend with full error visibility

echo "=== Backend Pre-flight Check ==="

# Test PostgreSQL connection
echo -n "Testing PostgreSQL connection... "
if PGPASSWORD=password123 psql -h localhost -U admin -d edumap_db -c "SELECT 1;" > /dev/null 2>&1; then
    echo "OK ✅"
else
    echo "FAILED ❌"
    echo "PostgreSQL is not reachable. Retrying in 5 seconds..."
    sleep 5
fi

# Test Redis connection
echo -n "Testing Redis connection... "
if redis-cli -h localhost ping 2>/dev/null | grep -q PONG; then
    echo "OK ✅"
else
    echo "FAILED ❌"
    echo "Redis is not reachable. Retrying in 5 seconds..."
    sleep 5
fi

echo "=== Starting NestJS Backend ==="
cd /app/backend
exec node dist/main
