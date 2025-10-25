#!/bin/bash
set -e

#################################################
# Complete Container Cleanup Script
# Stops ALL ai-dialer containers regardless of
# which docker-compose file started them
#################################################

echo "=========================================="
echo "🧹 AI Dialer - Complete Container Cleanup"
echo "=========================================="
echo ""

# Check if running as root or with docker permissions
if ! docker ps > /dev/null 2>&1; then
    echo "❌ ERROR: Cannot run docker commands"
    echo "   Either run with sudo or ensure user is in docker group"
    exit 1
fi

echo "📊 Current running containers:"
docker ps --filter "name=ai-dialer" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" || echo "   No ai-dialer containers found"
echo ""

# Stop all ai-dialer containers
echo "🛑 Stopping all ai-dialer containers..."
CONTAINERS=$(docker ps -a --filter "name=ai-dialer" -q)
if [ ! -z "$CONTAINERS" ]; then
    docker stop $CONTAINERS 2>/dev/null || true
    echo "   ✓ All containers stopped"
else
    echo "   ℹ️  No containers to stop"
fi
echo ""

# Remove all ai-dialer containers
echo "🗑️  Removing all ai-dialer containers..."
CONTAINERS=$(docker ps -a --filter "name=ai-dialer" -q)
if [ ! -z "$CONTAINERS" ]; then
    docker rm $CONTAINERS 2>/dev/null || true
    echo "   ✓ All containers removed"
else
    echo "   ℹ️  No containers to remove"
fi
echo ""

# Try to stop using all docker-compose files
echo "🔄 Stopping via docker-compose files..."

if [ -f "docker-compose.demo.yml" ]; then
    echo "   Stopping docker-compose.demo.yml..."
    docker-compose -f docker-compose.demo.yml down 2>/dev/null || true
fi

if [ -f "docker-compose.simplified.yml" ]; then
    echo "   Stopping docker-compose.simplified.yml..."
    docker-compose -f docker-compose.simplified.yml down 2>/dev/null || true
fi

if [ -f "docker-compose.yml" ]; then
    echo "   Stopping docker-compose.yml..."
    docker-compose -f docker-compose.yml down 2>/dev/null || true
fi

if [ -f "docker-compose.services.yml" ]; then
    echo "   Stopping docker-compose.services.yml..."
    docker-compose -f docker-compose.services.yml down 2>/dev/null || true
fi

echo "   ✓ All compose files processed"
echo ""

# Check for any remaining ai-dialer containers
echo "🔍 Verifying cleanup..."
REMAINING=$(docker ps -a --filter "name=ai-dialer" -q | wc -l)
if [ "$REMAINING" -eq 0 ]; then
    echo "   ✅ SUCCESS: All ai-dialer containers removed!"
else
    echo "   ⚠️  WARNING: $REMAINING container(s) still exist"
    docker ps -a --filter "name=ai-dialer"
fi
echo ""

# Show networks
echo "📡 AI Dialer networks:"
docker network ls --filter "name=ai-dialer" --format "table {{.Name}}\t{{.Driver}}"
echo ""

# Optional: Clean up dangling images to free space
echo "🧹 Cleaning up dangling images..."
docker image prune -f > /dev/null 2>&1
echo "   ✓ Dangling images removed"
echo ""

# Show data volumes (these are preserved!)
echo "💾 Data volumes (preserved):"
docker volume ls --filter "name=ai-dialer" --format "table {{.Name}}\t{{.Driver}}"
echo ""
echo "   ⚠️  NOTE: Volumes are NOT deleted (your data is safe)"
echo "   To delete volumes: docker volume rm postgres_data redis_data"
echo ""

echo "=========================================="
echo "✅ CLEANUP COMPLETE!"
echo "=========================================="
echo ""
echo "📋 Next steps:"
echo "   1. Verify no duplicate containers: docker ps -a | grep ai-dialer"
echo "   2. Start fresh deployment: ./deploy-simplified.sh"
echo "   3. Or use standard: ./update-production-auto.sh"
echo ""
echo "✨ You can now start with a clean slate!"
echo "=========================================="
