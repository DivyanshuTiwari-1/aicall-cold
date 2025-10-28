#!/bin/bash
###############################################################
# ASTERISK FIX SCRIPT - Fixes Stasis initialization issues
###############################################################

set -e

echo "🔧 Fixing Asterisk Configuration..."

cd /opt/ai-dialer

# Pull latest changes
echo "📥 Pulling latest code..."
git fetch origin
git pull origin main

# Restart Asterisk with new configuration
echo "🔄 Restarting Asterisk..."
docker-compose -f docker-compose.demo.yml up -d --force-recreate asterisk

# Wait for Asterisk to start
echo "⏳ Waiting for Asterisk to start..."
sleep 20

# Check if Asterisk is running
echo "✅ Checking Asterisk status..."
if docker exec ai-dialer-asterisk asterisk -rx "core show version" 2>&1 | grep -q "Asterisk"; then
    echo "✅ Asterisk is RUNNING!"
    docker exec ai-dialer-asterisk asterisk -rx "core show version"
    echo ""
    echo "✅ Checking ARI status..."
    docker exec ai-dialer-asterisk asterisk -rx "ari show status"
else
    echo "❌ Asterisk failed to start. Checking logs..."
    docker logs ai-dialer-asterisk --tail 50
    exit 1
fi

# Restart backend to reconnect to Asterisk
echo "🔄 Restarting backend to reconnect..."
docker-compose -f docker-compose.demo.yml restart backend

sleep 10

# Check backend health
echo "✅ Checking backend health..."
docker exec ai-dialer-backend curl -f -s http://localhost:3000/health || echo "⚠️  Backend health check failed"

# Check all services
echo ""
echo "📊 System Status:"
docker-compose -f docker-compose.demo.yml ps

echo ""
echo "✅ Fix complete! Checking for automated calls capability..."

# Check database for campaigns
CAMPAIGN_COUNT=$(docker exec ai-dialer-postgres psql -U postgres -d ai_dialer -t -c "SELECT COUNT(*) FROM campaigns WHERE status = 'active';" 2>/dev/null | xargs)
echo "Active campaigns: $CAMPAIGN_COUNT"

CONTACT_COUNT=$(docker exec ai-dialer-postgres psql -U postgres -d ai_dialer -t -c "SELECT COUNT(*) FROM contacts WHERE status IN ('pending', 'new');" 2>/dev/null | xargs)
echo "Available contacts: $CONTACT_COUNT"

echo ""
echo "🎉 Asterisk is now ready for automated AI calls!"
echo ""
echo "Next steps:"
echo "1. Visit https://atsservice.site/"
echo "2. Go to Campaigns page"
echo "3. Select an active campaign"
echo "4. Click 'Start Automated Calls'"
echo ""
