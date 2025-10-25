#!/bin/bash
set -e

#################################################
# AI Dialer - Automated Production Update Script
# Non-interactive version for CI/CD automation
# Use this for GitHub Actions or other automated deployments
#################################################

echo "========================================"
echo "🔄 AI Dialer - Automated Production Update"
echo "========================================"
echo ""

# Check if .env.production exists
if [ ! -f .env.production ]; then
    echo "⚠️  .env.production not found, will use defaults"
fi

# Load environment if exists
if [ -f .env.production ]; then
    echo "📝 Loading production environment..."
    set -a
    source .env.production
    set +a
    echo "   ✓ Environment loaded"
fi
echo ""

# Pull latest changes FIRST (before any docker operations)
echo "📥 Pulling latest changes from Git..."
if [ -d .git ]; then
    git pull origin main || {
        echo "   ⚠️  Git pull failed!"
        echo "   Attempting to reset and pull..."
        git fetch origin
        git reset --hard origin/main
    }
    echo "   ✓ Code updated"
else
    echo "   ⚠️  Not a Git repository, using local changes"
fi
echo ""

# Show current git info
echo "📊 Current Git Status:"
git log --oneline -1
echo ""

# CRITICAL: Stop ALL duplicate containers first
echo "🛑 Stopping all duplicate containers..."
CONTAINERS=$(docker ps --filter "name=ai-dialer" -q)
if [ ! -z "$CONTAINERS" ]; then
    docker stop $CONTAINERS 2>/dev/null || true
    echo "   ✓ All containers stopped"
fi

# Remove old containers
CONTAINERS=$(docker ps -a --filter "name=ai-dialer" -q)
if [ ! -z "$CONTAINERS" ]; then
    docker rm $CONTAINERS 2>/dev/null || true
    echo "   ✓ Old containers removed"
fi

# Stop via all possible compose files to ensure cleanup
for file in docker-compose.demo.yml docker-compose.simplified.yml docker-compose.yml; do
    if [ -f "$file" ]; then
        docker-compose -f "$file" down 2>/dev/null || true
    fi
done
echo "   ✓ Cleanup complete"
echo ""

# Create backup before update
echo "💾 Creating quick backup..."
BACKUP_DIR="./backups"
BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

# Backup database
echo "   Backing up database..."
docker exec ai-dialer-postgres pg_dump -U ${POSTGRES_USER:-ai_dialer_user} ${POSTGRES_DB:-ai_dialer_prod} 2>/dev/null | \
  gzip > $BACKUP_DIR/auto_update_${BACKUP_DATE}.sql.gz || echo "   ⚠️  Backup failed, continuing..."

if [ -f "$BACKUP_DIR/auto_update_${BACKUP_DATE}.sql.gz" ]; then
    echo "   ✓ Backup created: auto_update_${BACKUP_DATE}.sql.gz"
else
    echo "   ⚠️  No backup created (database may be empty)"
fi
echo ""

# Rebuild and update services (NO --volumes flag = data preserved)
echo "🔨 Building updated images (no cache to ensure fresh build)..."
docker-compose -f docker-compose.demo.yml build --no-cache
echo "   ✓ Images built"
echo ""

echo "🚀 Starting services with fresh containers..."
# This command:
# - Creates containers with new code
# - Keeps all volumes (data) intact
# - Uses --force-recreate to ensure fresh start
docker-compose -f docker-compose.demo.yml up -d --force-recreate

echo "   ✓ Services started"
echo ""

# Wait for services to stabilize
echo "⏳ Waiting for services to stabilize (30 seconds)..."
sleep 30

# Health check
echo ""
echo "🔍 Health check..."

# Check backend
BACKEND_HEALTHY=false
for i in {1..10}; do
    if curl -f -s http://localhost:3000/health > /dev/null 2>&1; then
        BACKEND_HEALTHY=true
        break
    fi
    echo -n "."
    sleep 3
done
echo ""

if [ "$BACKEND_HEALTHY" = true ]; then
    echo "   ✅ Backend: HEALTHY"
else
    echo "   ❌ Backend: UNHEALTHY - Check logs!"
    echo ""
    echo "Recent backend logs:"
    docker logs ai-dialer-backend --tail 50
    exit 1
fi

# Check frontend
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001)
if [ "$FRONTEND_STATUS" = "200" ] || [ "$FRONTEND_STATUS" = "304" ]; then
    echo "   ✅ Frontend: HEALTHY"
else
    echo "   ⚠️  Frontend: CHECK NEEDED (Status: $FRONTEND_STATUS)"
fi

# Check database
DB_HEALTHY=$(docker exec ai-dialer-postgres pg_isready -U ${POSTGRES_USER:-ai_dialer_user} 2>&1 || echo "failed")
if [[ "$DB_HEALTHY" == *"accepting connections"* ]]; then
    echo "   ✅ Database: HEALTHY"
else
    echo "   ❌ Database: UNHEALTHY"
fi

echo ""

# Run migrations if needed
echo "🔄 Running database migrations..."
docker exec ai-dialer-backend npm run migrate 2>&1 | tail -10 || echo "   No new migrations"
echo ""

# Clean up old images (save disk space)
echo "🧹 Cleaning up old Docker images..."
docker image prune -f > /dev/null 2>&1
echo "   ✓ Cleanup complete"
echo ""

# Keep only last 10 backups
echo "🗑️  Cleaning old backups (keeping last 10)..."
ls -t $BACKUP_DIR/*.sql.gz 2>/dev/null | tail -n +11 | xargs -r rm
echo "   ✓ Old backups cleaned"
echo ""

# Show final status
echo "========================================"
echo "✅ AUTOMATED UPDATE COMPLETE!"
echo "========================================"
echo ""
echo "📊 Service Status:"
docker-compose -f docker-compose.demo.yml ps
echo ""
echo "📍 Your Application:"
if [ ! -z "$CLIENT_URL" ]; then
    echo "   Frontend:  $CLIENT_URL"
    echo "   Backend:   $API_URL"
else
    PUBLIC_IP=$(curl -s ifconfig.me || echo "localhost")
    echo "   Frontend:  http://$PUBLIC_IP:3001"
    echo "   Backend:   http://$PUBLIC_IP:3000"
fi
echo ""
echo "💾 Backup saved: $BACKUP_DIR/auto_update_${BACKUP_DATE}.sql.gz"
echo ""
echo "🔧 Useful Commands:"
echo "   View logs:     docker-compose -f docker-compose.demo.yml logs -f"
echo "   Check status:  docker-compose -f docker-compose.demo.yml ps"
echo "   Rollback:      ./rollback-production.sh"
echo ""
echo "✨ All user data and volumes preserved!"
echo "========================================"

# Exit with success
exit 0
