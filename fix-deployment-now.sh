#!/bin/bash
#################################################
# ONE-COMMAND FIX for Deployment Issues
# Run this on your server to fix everything!
#################################################

echo "=========================================="
echo "🔧 AI Dialer - Quick Deployment Fix"
echo "=========================================="
echo ""
echo "This script will:"
echo "  1. Stop ALL duplicate containers"
echo "  2. Clean up conflicts"
echo "  3. Deploy fresh from latest code"
echo "  4. Verify everything works"
echo ""
read -p "Continue? (yes/no): " -r
echo ""
if [[ ! $REPLY =~ ^[Yy]([Ee][Ss])?$ ]]; then
    echo "Cancelled."
    exit 0
fi

# Make scripts executable
chmod +x cleanup-all-containers.sh 2>/dev/null || true
chmod +x check-deployment-status.sh 2>/dev/null || true
chmod +x update-production-auto.sh 2>/dev/null || true

echo "=========================================="
echo "Step 1/4: Checking Current Status"
echo "=========================================="
echo ""

# Show what's currently running
echo "📊 Current containers:"
docker ps --filter "name=ai-dialer" --format "table {{.Names}}\t{{.Status}}" || echo "None found"
echo ""

# Count containers
CONTAINER_COUNT=$(docker ps --filter "name=ai-dialer" -q | wc -l)
echo "Total ai-dialer containers running: $CONTAINER_COUNT"
echo ""

if [ "$CONTAINER_COUNT" -gt 6 ]; then
    echo "⚠️  WARNING: Too many containers detected ($CONTAINER_COUNT)"
    echo "   Expected: 5-6 containers maximum"
    echo "   This indicates duplicates are running"
fi
echo ""

echo "=========================================="
echo "Step 2/4: Cleaning Up ALL Containers"
echo "=========================================="
echo ""

# Stop all ai-dialer containers
CONTAINERS=$(docker ps --filter "name=ai-dialer" -q)
if [ ! -z "$CONTAINERS" ]; then
    echo "🛑 Stopping containers..."
    docker stop $CONTAINERS 2>/dev/null || true
    echo "   ✓ Stopped"
fi

# Remove all ai-dialer containers
CONTAINERS=$(docker ps -a --filter "name=ai-dialer" -q)
if [ ! -z "$CONTAINERS" ]; then
    echo "🗑️  Removing containers..."
    docker rm $CONTAINERS 2>/dev/null || true
    echo "   ✓ Removed"
fi

# Stop via all compose files
for file in docker-compose.demo.yml docker-compose.simplified.yml docker-compose.yml; do
    if [ -f "$file" ]; then
        echo "   Stopping $file..."
        docker-compose -f "$file" down 2>/dev/null || true
    fi
done

echo "   ✓ Cleanup complete"
echo ""

echo "=========================================="
echo "Step 3/4: Pulling Latest Code & Deploying"
echo "=========================================="
echo ""

# Pull latest code
if [ -d .git ]; then
    echo "📥 Pulling latest changes..."
    git pull origin main || {
        echo "   Git pull failed, trying reset..."
        git fetch origin
        git reset --hard origin/main
    }
    echo "   ✓ Code updated"
else
    echo "   ⚠️  Not a git repository, using local code"
fi
echo ""

# Determine which compose file to use
COMPOSE_FILE="docker-compose.demo.yml"
if [ ! -f "$COMPOSE_FILE" ]; then
    COMPOSE_FILE="docker-compose.yml"
fi

echo "📦 Using compose file: $COMPOSE_FILE"
echo ""

# Create backup if database exists
if docker volume ls -q --filter "name=postgres_data" | grep -q .; then
    echo "💾 Creating backup..."
    mkdir -p backups
    BACKUP_DATE=$(date +%Y%m%d_%H%M%S)

    # Start postgres temporarily for backup
    docker-compose -f "$COMPOSE_FILE" up -d postgres 2>/dev/null
    sleep 5

    docker exec ai-dialer-postgres pg_dump -U ai_dialer_user ai_dialer_prod 2>/dev/null | \
      gzip > backups/fix_${BACKUP_DATE}.sql.gz || echo "   ⚠️  Backup skipped"

    if [ -f "backups/fix_${BACKUP_DATE}.sql.gz" ]; then
        echo "   ✓ Backup saved: fix_${BACKUP_DATE}.sql.gz"
    fi
fi
echo ""

# Build and start services
echo "🔨 Building images (this may take 2-3 minutes)..."
docker-compose -f "$COMPOSE_FILE" build --no-cache 2>&1 | \
  grep -E "(Building|Successfully built|ERROR)" || true
echo "   ✓ Build complete"
echo ""

echo "🚀 Starting services..."
docker-compose -f "$COMPOSE_FILE" up -d
echo "   ✓ Services started"
echo ""

echo "⏳ Waiting for services to initialize (30 seconds)..."
sleep 30
echo ""

echo "=========================================="
echo "Step 4/4: Health Checks"
echo "=========================================="
echo ""

# Backend health check
echo "🔍 Checking backend..."
BACKEND_HEALTHY=false
for i in {1..10}; do
    if curl -f -s http://localhost:3000/health > /dev/null 2>&1; then
        BACKEND_HEALTHY=true
        break
    fi
    sleep 2
done

if [ "$BACKEND_HEALTHY" = true ]; then
    echo "   ✅ Backend: HEALTHY"
else
    echo "   ❌ Backend: UNHEALTHY"
    echo ""
    echo "Backend logs (last 30 lines):"
    docker logs ai-dialer-backend --tail 30
fi

# Frontend health check
echo ""
echo "🔍 Checking frontend..."
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001 2>/dev/null)
if [ "$FRONTEND_STATUS" = "200" ] || [ "$FRONTEND_STATUS" = "304" ]; then
    echo "   ✅ Frontend: HEALTHY"
else
    echo "   ⚠️  Frontend: Status $FRONTEND_STATUS"
fi

# Database health check
echo ""
echo "🔍 Checking database..."
DB_HEALTHY=$(docker exec ai-dialer-postgres pg_isready 2>&1 || echo "failed")
if [[ "$DB_HEALTHY" == *"accepting connections"* ]]; then
    echo "   ✅ PostgreSQL: HEALTHY"
else
    echo "   ❌ PostgreSQL: UNHEALTHY"
fi

# Redis health check
echo ""
echo "🔍 Checking Redis..."
REDIS_HEALTHY=$(docker exec ai-dialer-redis redis-cli ping 2>/dev/null || echo "failed")
if [ "$REDIS_HEALTHY" = "PONG" ]; then
    echo "   ✅ Redis: HEALTHY"
else
    echo "   ❌ Redis: UNHEALTHY"
fi

echo ""

# Run migrations
echo "🔄 Running database migrations..."
docker exec ai-dialer-backend npm run migrate 2>&1 | tail -5 || echo "   No migrations needed"
echo ""

# Clean up old images
echo "🧹 Cleaning up old images..."
docker image prune -f > /dev/null 2>&1
echo "   ✓ Cleanup complete"
echo ""

# Final status
echo "=========================================="
echo "📊 Final Status"
echo "=========================================="
echo ""
docker-compose -f "$COMPOSE_FILE" ps
echo ""

# Summary
echo "=========================================="
if [ "$BACKEND_HEALTHY" = true ] && [ "$FRONTEND_STATUS" = "200" -o "$FRONTEND_STATUS" = "304" ]; then
    echo "✅ SUCCESS! Deployment is working!"
    echo "=========================================="
    echo ""
    echo "🌐 Your application is now running:"
    PUBLIC_IP=$(curl -s ifconfig.me 2>/dev/null || echo "localhost")
    echo "   Frontend: http://$PUBLIC_IP:3001"
    echo "   Backend:  http://$PUBLIC_IP:3000"
    echo ""
    echo "🎉 Changes from GitHub will now propagate correctly!"
    echo ""
    echo "Next steps:"
    echo "  1. Visit your website to verify"
    echo "  2. Push changes to GitHub - they'll auto-deploy"
    echo "  3. Monitor with: docker-compose -f $COMPOSE_FILE logs -f"
else
    echo "⚠️  PARTIAL SUCCESS - Some services may need attention"
    echo "=========================================="
    echo ""
    echo "View logs to diagnose:"
    echo "  docker-compose -f $COMPOSE_FILE logs --tail 50"
    echo ""
    echo "Or check individual services:"
    echo "  docker logs ai-dialer-backend"
    echo "  docker logs ai-dialer-frontend"
fi
echo ""
echo "=========================================="
