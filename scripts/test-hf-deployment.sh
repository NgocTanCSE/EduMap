#!/bin/bash

# =====================================================
# EduMap Hugging Face Deployment Test Script
# =====================================================

echo "=========================================="
echo "EduMap HF Deployment Test"
echo "=========================================="

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

echo "✅ Docker is running"

# Check if docker-compose.hf.yml exists
if [ ! -f "docker-compose.hf.yml" ]; then
    echo "❌ docker-compose.hf.yml not found"
    exit 1
fi

echo "✅ docker-compose.hf.yml found"

# Check if .env.hf exists
if [ ! -f ".env.hf" ]; then
    echo "❌ .env.hf not found"
    exit 1
fi

echo "✅ .env.hf found"

# Build and start services
echo ""
echo "Building and starting services..."
docker-compose -f docker-compose.hf.yml --env-file .env.hf up -d --build

# Wait for services to start
echo ""
echo "Waiting for services to start..."
sleep 30

# Check service health
echo ""
echo "Checking service health..."

# Check PostgreSQL
if docker-compose -f docker-compose.hf.yml ps postgres | grep -q "Up"; then
    echo "✅ PostgreSQL is running"
else
    echo "❌ PostgreSQL is not running"
fi

# Check Redis
if docker-compose -f docker-compose.hf.yml ps redis | grep -q "Up"; then
    echo "✅ Redis is running"
else
    echo "❌ Redis is not running"
fi

# Check Backend
if docker-compose -f docker-compose.hf.yml ps backend | grep -q "Up"; then
    echo "✅ Backend is running"
else
    echo "❌ Backend is not running"
fi

# Check Frontend
if docker-compose -f docker-compose.hf.yml ps frontend | grep -q "Up"; then
    echo "✅ Frontend is running"
else
    echo "❌ Frontend is not running"
fi

# Check AI Service
if docker-compose -f docker-compose.hf.yml ps ai-service | grep -q "Up"; then
    echo "✅ AI Service is running"
else
    echo "❌ AI Service is not running"
fi

# Test endpoints
echo ""
echo "Testing endpoints..."

# Test Backend health
if curl -s http://localhost:3000/api/health > /dev/null; then
    echo "✅ Backend health check passed"
else
    echo "❌ Backend health check failed"
fi

# Test AI Service health
if curl -s http://localhost:8000/health > /dev/null; then
    echo "✅ AI Service health check passed"
else
    echo "❌ AI Service health check failed"
fi

# Test Frontend
if curl -s http://localhost:3001 > /dev/null; then
    echo "✅ Frontend is accessible"
else
    echo "❌ Frontend is not accessible"
fi

echo ""
echo "=========================================="
echo "Test completed!"
echo "=========================================="
echo ""
echo "To view logs:"
echo "  docker-compose -f docker-compose.hf.yml logs -f"
echo ""
echo "To stop services:"
echo "  docker-compose -f docker-compose.hf.yml down"
echo ""
echo "To clean up:"
echo "  docker-compose -f docker-compose.hf.yml down -v"
