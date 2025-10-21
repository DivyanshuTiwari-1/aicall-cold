#!/bin/bash

# Docker initialization script for AI Dialer
echo "🚀 Starting AI Dialer initialization..."

# Wait for database to be ready
echo "⏳ Waiting for database to be ready..."
until pg_isready -h postgres -p 5432 -U postgres -d ai_dialer; do
  echo "Database is unavailable - sleeping"
  sleep 2
done

echo "✅ Database is ready!"

# Run database migrations
echo "🔄 Running database migrations..."
cd /usr/src/app
npm run migrate

# Seed the database with sample data
echo "🌱 Seeding database with sample data..."
npm run seed

echo "✅ AI Dialer initialization complete!"
echo "🎉 Application is ready to use!"

# Start the main application
echo "🚀 Starting AI Dialer server..."
npm run server:dev
