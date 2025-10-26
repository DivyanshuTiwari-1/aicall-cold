#!/bin/bash
set -e

#################################################
# Smart Production Deployment Script
# Only rebuilds what changed, saves disk space
#################################################

echo "========================================"
echo "🚀 Smart Production Deployment"
echo "========================================"
echo ""

SERVER_USER="ubuntu"
SERVER_HOST="13.53.89.241"
SSH_KEY="$HOME/.ssh/ai-dialer-key.pem"

echo "📡 Deploying to: $SERVER_USER@$SERVER_HOST"
echo ""

# Deploy to production
ssh -i "$SSH_KEY" $SERVER_USER@$SERVER_HOST << 'ENDSSH'
set -e

cd /opt/ai-dialer || { echo "❌ Cannot find application directory"; exit 1; }

echo "📂 Working in: $(pwd)"
echo ""

# Get current commit
BEFORE_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "none")

# Pull latest code
echo "📥 Pulling latest code..."
git fetch origin
git reset --hard origin/main

AFTER_COMMIT=$(git rev-parse HEAD)

echo "✓ Updated to: $(git log --oneline -1)"
echo ""

# Check if this is first deploy or if code changed
if [ "$BEFORE_COMMIT" = "none" ] || [ "$BEFORE_COMMIT" = "$AFTER_COMMIT" ]; then
    if [ "$BEFORE_COMMIT" = "$AFTER_COMMIT" ]; then
        echo "ℹ️  No code changes, just restarting services..."
        docker-compose -f docker-compose.demo.yml restart
        exit 0
    fi
fi

# Detect what changed
CHANGED_FILES=$(git diff --name-only $BEFORE_COMMIT $AFTER_COMMIT 2>/dev/null || echo "all")

echo "📝 Analyzing changes..."

REBUILD_FRONTEND=false
REBUILD_BACKEND=false
REBUILD_ASTERISK=false

if [ "$CHANGED_FILES" = "all" ]; then
    echo "   🔄 First deployment - rebuilding all services"
    REBUILD_FRONTEND=true
    REBUILD_BACKEND=true
    REBUILD_ASTERISK=true
else
    if echo "$CHANGED_FILES" | grep -q "^client/"; then
        REBUILD_FRONTEND=true
        echo "   🔄 Frontend changes detected"
    fi

    if echo "$CHANGED_FILES" | grep -q "^server/"; then
        REBUILD_BACKEND=true
        echo "   🔄 Backend changes detected"
    fi

    if echo "$CHANGED_FILES" | grep -qE "^(asterisk-config/|Dockerfile\.asterisk)"; then
        REBUILD_ASTERISK=true
        echo "   🔄 Asterisk changes detected"
    fi

    if [ "$REBUILD_FRONTEND" = false ] && [ "$REBUILD_BACKEND" = false ] && [ "$REBUILD_ASTERISK" = false ]; then
        echo "   ℹ️  Only config files changed, restarting services..."
        docker-compose -f docker-compose.demo.yml restart
        exit 0
    fi
fi

echo ""
echo "🔨 Rebuilding changed services..."

# Rebuild only what changed
if [ "$REBUILD_FRONTEND" = true ]; then
    echo "   📦 Building frontend (this takes ~2 min)..."
    docker-compose -f docker-compose.demo.yml build --no-cache frontend
fi

if [ "$REBUILD_BACKEND" = true ]; then
    echo "   📦 Building backend..."
    docker-compose -f docker-compose.demo.yml build --no-cache backend
fi

if [ "$REBUILD_ASTERISK" = true ]; then
    echo "   📦 Building asterisk..."
    docker-compose -f docker-compose.demo.yml build --no-cache asterisk
fi

echo ""
echo "🚀 Starting services..."
docker-compose -f docker-compose.demo.yml up -d

echo ""
echo "🧹 Cleaning up old images (saves disk space)..."
docker image prune -f

echo ""
echo "⏳ Waiting for services to stabilize..."
sleep 15

# Run migrations if backend changed
if [ "$REBUILD_BACKEND" = true ]; then
    echo ""
    echo "🔄 Running database migrations..."
    docker exec ai-dialer-backend npm run migrate 2>&1 || echo "⚠️ Migrations may have already run"
fi

echo ""
echo "📊 Service Status:"
docker-compose -f docker-compose.demo.yml ps

echo ""
echo "💾 Disk Usage After Cleanup:"
docker system df -v | grep -A 3 "Images space usage"

echo ""
echo "========================================"
echo "✅ DEPLOYMENT COMPLETED!"
echo "========================================"
echo ""
echo "🌐 Site: https://atsservice.site/"
echo "📦 Commit: $(git log --oneline -1)"
echo ""

ENDSSH

echo "✅ Deployment script finished!"
echo ""
