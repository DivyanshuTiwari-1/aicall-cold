#!/bin/bash
set -e

#################################################
# AI Dialer - Production Rollback Script
# Rolls back to previous version if update fails
#################################################

echo "========================================"
echo "⏮️  AI Dialer - Production Rollback"
echo "========================================"
echo ""

# Check if backups exist
BACKUP_DIR="./backups"
if [ ! -d "$BACKUP_DIR" ] || [ -z "$(ls -A $BACKUP_DIR)" ]; then
    echo "❌ No backups found in $BACKUP_DIR"
    exit 1
fi

# Show available backups
echo "📦 Available backups:"
ls -lh $BACKUP_DIR/*.sql.gz 2>/dev/null || echo "No database backups found"
echo ""

# List recent commits
if [ -d .git ]; then
    echo "📜 Recent commits:"
    git log --oneline -10
    echo ""

    # Get current commit
    CURRENT_COMMIT=$(git rev-parse --short HEAD)
    echo "Current commit: $CURRENT_COMMIT"
    echo ""

    # Ask which commit to rollback to
    read -p "Enter commit hash to rollback to (or 'latest' for most recent backup): " ROLLBACK_TARGET
    echo ""

    if [ "$ROLLBACK_TARGET" != "latest" ]; then
        echo "🔄 Rolling back code to $ROLLBACK_TARGET..."
        git checkout $ROLLBACK_TARGET
        echo "   ✓ Code rolled back"
        echo ""
    fi
fi

# Ask about database restore
read -p "Do you want to restore the database? (yes/no): " RESTORE_DB
echo ""

if [ "$RESTORE_DB" = "yes" ]; then
    # Find most recent backup
    LATEST_BACKUP=$(ls -t $BACKUP_DIR/*.sql.gz | head -1)

    echo "📥 Restoring database from: $(basename $LATEST_BACKUP)"
    echo "   ⚠️  WARNING: This will restore to the backup state!"
    read -p "   Continue? (yes/no): " confirm

    if [ "$confirm" = "yes" ]; then
        # Load environment
        if [ -f .env.production ]; then
            set -a
            source .env.production
            set +a
        fi

        echo "   Restoring database..."
        gunzip < $LATEST_BACKUP | \
          docker exec -i ai-dialer-postgres psql -U ${POSTGRES_USER:-ai_dialer_user} ${POSTGRES_DB:-ai_dialer_prod}

        echo "   ✓ Database restored"
    fi
fi
echo ""

# Rebuild and restart
echo "🚀 Rebuilding and restarting services..."
docker-compose -f docker-compose.demo.yml down
docker-compose -f docker-compose.demo.yml build --no-cache
docker-compose -f docker-compose.demo.yml up -d
echo "   ✓ Services restarted"
echo ""

# Wait for services
echo "⏳ Waiting for services (30 seconds)..."
sleep 30

# Health check
echo ""
echo "🔍 Health check..."

BACKEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health)
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001)

echo ""
echo "========================================"
echo "✅ ROLLBACK COMPLETE!"
echo "========================================"
echo ""
echo "📊 Service Status:"
echo "   Backend:   $( [ "$BACKEND_STATUS" = "200" ] && echo "✅ RUNNING" || echo "❌ CHECK LOGS")"
echo "   Frontend:  $( [ "$FRONTEND_STATUS" = "200" ] && echo "✅ RUNNING" || echo "❌ CHECK LOGS")"
echo ""
echo "🔧 Check logs if needed:"
echo "   docker-compose -f docker-compose.demo.yml logs -f"
echo ""
echo "========================================"
