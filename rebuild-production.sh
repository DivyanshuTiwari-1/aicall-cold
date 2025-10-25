#!/bin/bash
set -e

#################################################
# FORCE REBUILD - Cleans duplicates and rebuilds
# Run this on the server to fix deployment issues
#################################################

echo "🔧 Force Rebuild Production"
echo ""

# Stop EVERYTHING with ai-dialer name
echo "🛑 Stopping all ai-dialer containers..."
docker stop $(docker ps -a --filter "name=ai-dialer" -q) 2>/dev/null || true
docker rm $(docker ps -a --filter "name=ai-dialer" -q) 2>/dev/null || true

# Stop via all compose files
docker-compose -f docker-compose.demo.yml down 2>/dev/null || true
docker-compose -f docker-compose.simplified.yml down 2>/dev/null || true
docker-compose -f docker-compose.yml down 2>/dev/null || true

echo "✓ All containers stopped and removed"
echo ""

# Pull latest code
echo "📥 Pulling latest code..."
git fetch origin
git reset --hard origin/main
echo "✓ Code updated"
echo ""

# Rebuild everything from scratch
echo "🔨 Building fresh images..."
docker-compose -f docker-compose.demo.yml build --no-cache --pull
echo "✓ Build complete"
echo ""

# Start services
echo "🚀 Starting services..."
docker-compose -f docker-compose.demo.yml up -d
echo "✓ Services started"
echo ""

# Wait for services
echo "⏳ Waiting 30 seconds for services..."
sleep 30

# Health check
echo "🔍 Health check..."
curl -f http://localhost:3000/health && echo "✓ Backend healthy" || echo "✗ Backend unhealthy"
curl -f http://localhost:3001 && echo "✓ Frontend healthy" || echo "✗ Frontend unhealthy"
echo ""

# Show status
docker-compose -f docker-compose.demo.yml ps
echo ""
echo "✅ Rebuild complete!"

