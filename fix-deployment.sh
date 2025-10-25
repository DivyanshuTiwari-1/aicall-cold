#!/bin/bash

cd /opt/ai-dialer

echo "======================================"
echo "🔍 Current situation:"
echo "======================================"
git log --oneline -3
echo ""
echo "Server is ahead by this commit:"
git log origin/main..HEAD --oneline

echo ""
echo "======================================"
echo "🔧 FIXING: Resetting to match GitHub"
echo "======================================"

# Discard the local commit on server
git reset --hard origin/main

# Pull latest from GitHub
git pull origin main

echo ""
echo "======================================"
echo "✅ Git Status After Fix:"
echo "======================================"
git status

echo ""
echo "Latest 3 commits now deployed:"
git log --oneline -3

echo ""
echo "======================================"
echo "🚀 Rebuilding containers with latest code"
echo "======================================"

docker-compose -f docker-compose.demo.yml down

echo "Removing old images..."
docker rmi -f ai-dialer-frontend ai-dialer-backend 2>/dev/null || true

echo "Building fresh images (no cache)..."
docker-compose -f docker-compose.demo.yml build --no-cache --pull

echo "Starting fresh containers..."
docker-compose -f docker-compose.demo.yml up -d

echo ""
echo "Waiting 60 seconds for services to start..."
sleep 60

echo ""
echo "======================================"
echo "✅ DEPLOYMENT COMPLETE!"
echo "======================================"
docker-compose -f docker-compose.demo.yml ps

echo ""
echo "🌐 Clear browser cache and visit:"
echo "   https://atsservice.site"
echo ""
echo "Press Ctrl+Shift+R to hard refresh!"
echo "======================================"
