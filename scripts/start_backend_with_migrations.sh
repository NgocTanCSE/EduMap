#!/bin/sh

echo "Running database migrations..."
npm run migration:run


echo "Starting application..."
npm run start:prod
