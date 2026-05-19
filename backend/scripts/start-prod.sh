#!/bin/sh
# 1. Run migrations
echo "Running database migrations..."
npm run migration:run

# 2. Start the application
echo "Starting application..."
npm run start:prod
