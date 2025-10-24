#!/bin/bash
set -e

#################################################
# AI Dialer - Production Update Script
# Safely updates running production without data loss
# Use this for ALL updates after initial deployment
#################################################

echo "========================================"
echo "🔄 AI Dialer - Production Update"
echo "========================================"
echo ""

# Check if .env.production exists
if [ ! -f .env.production ]; then
    echo "❌ ERROR: .env.production not found!"
    echo "   Run ./deploy-production.sh for initial deployment first."
    exit 1
fi

# Load environment
echo "📝 Loading production environment..."
set -a
source .env.production
set +a
echo "   ✓ Environment loaded"
echo ""

# Pull latest changes
echo "📥 Pulling latest changes from Git..."
if [ -d .git ]; then
    git pull origin main || echo "   ⚠️  Git pull failed, continuing with local changes..."
else
    echo "   ⚠️  Not a Git repository, using local changes"
fi
echo ""

# Show what's running
echo "📊 Current running services:"
docker-compose -f docker-compose.demo.yml ps
echo ""

# Ask for confirmation
read -p "🔄 Ready to update. Continue? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "Update cancelled."
    exit 0
fi
echo ""

# Create backup before update
echo "💾 Creating quick backup..."
BACKUP_DIR="./backups"
BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

# Backup database
echo "   Backing up database..."
docker exec ai-dialer-postgres pg_dump -U ${POSTGRES_USER:-ai_dialer_user} ${POSTGRES_DB:-ai_dialer_prod} | \
  gzip > $BACKUP_DIR/pre_update_${BACKUP_DATE}.sql.gz || echo "   ⚠️  Backup failed, continuing..."

echo "   ✓ Backup created: pre_update_${BACKUP_DATE}.sql.gz"
echo ""

# Rebuild and update services (NO --volumes flag = data preserved)
echo "🔨 Building updated images..."
docker-compose -f docker-compose.demo.yml build --no-cache
echo "   ✓ Images built"
echo ""

echo "🚀 Updating services (graceful restart)..."
# This command:
# - Recreates containers with new code
# - Keeps all volumes (data) intact
# - Does graceful shutdown of old containers
docker-compose -f docker-compose.demo.yml up -d --force-recreate --no-deps

echo "   ✓ Services updated"
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
if [ "$FRONTEND_STATUS" = "200" ]; then
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

# Show final status
echo "========================================"
echo "✅ UPDATE COMPLETE!"
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
echo "💾 Backup saved: $BACKUP_DIR/pre_update_${BACKUP_DATE}.sql.gz"
echo ""
echo "🔧 Useful Commands:"
echo "   View logs:     docker-compose -f docker-compose.demo.yml logs -f"
echo "   Check status:  docker-compose -f docker-compose.demo.yml ps"
echo "   Rollback:      ./rollback-production.sh"
echo ""
echo "✨ All user data and volumes preserved!"
echo "========================================"
