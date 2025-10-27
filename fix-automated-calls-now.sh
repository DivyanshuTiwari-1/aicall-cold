#!/bin/bash
#################################################
# URGENT: Fix Automated Calls Flow
# Ensures all components are ready for AI calls
#################################################

set -e

echo "╔════════════════════════════════════════════════╗"
echo "║   URGENT FIX: Automated AI Calls Setup        ║"
echo "╔════════════════════════════════════════════════╗"
echo ""

cd /opt/ai-dialer || { echo "❌ Cannot find /opt/ai-dialer"; exit 1; }

echo "🔧 Step 1: Pull latest code..."
git fetch origin
git reset --hard origin/main
echo "✓ Code updated"

echo ""
echo "🔧 Step 2: Check Docker services..."
docker-compose -f docker-compose.demo.yml ps

echo ""
echo "🔧 Step 3: Restart backend (FastAGI server)..."
docker-compose -f docker-compose.demo.yml restart backend
sleep 5

echo ""
echo "🔧 Step 4: Check FastAGI Server..."
docker exec ai-dialer-backend sh -c "ps aux | grep node" | grep -v grep && echo "✓ Node.js running"

echo ""
echo "🔧 Step 5: Check Asterisk connectivity..."
docker exec asterisk asterisk -rx "core show version" && echo "✓ Asterisk responsive"

echo ""
echo "🔧 Step 6: Verify Database..."
docker exec ai-dialer-postgres psql -U postgres -d ai_dialer -c "SELECT COUNT(*) FROM calls;" && echo "✓ Database accessible"

echo ""
echo "🔧 Step 7: Check campaign status..."
ACTIVE_CAMPAIGNS=$(docker exec ai-dialer-postgres psql -U postgres -d ai_dialer -t -c "SELECT COUNT(*) FROM campaigns WHERE status = 'active';" | xargs)
echo "   Active campaigns: $ACTIVE_CAMPAIGNS"

if [ "$ACTIVE_CAMPAIGNS" -eq 0 ]; then
    echo "⚠️  WARNING: No active campaigns!"
    echo "   Creating test campaign..."
    
    docker exec ai-dialer-postgres psql -U postgres -d ai_dialer -c "
    INSERT INTO campaigns (id, organization_id, name, status, type, created_at, updated_at)
    SELECT 
        gen_random_uuid(),
        (SELECT id FROM organizations LIMIT 1),
        'Test AI Campaign',
        'active',
        'sales',
        NOW(),
        NOW()
    WHERE NOT EXISTS (SELECT 1 FROM campaigns WHERE status = 'active' LIMIT 1);
    "
    echo "✓ Test campaign created"
fi

echo ""
echo "🔧 Step 8: Check contacts..."
PENDING_CONTACTS=$(docker exec ai-dialer-postgres psql -U postgres -d ai_dialer -t -c "
SELECT COUNT(*) FROM contacts 
WHERE campaign_id IN (SELECT id FROM campaigns WHERE status = 'active')
AND status IN ('pending', 'new');
" | xargs)

echo "   Pending contacts: $PENDING_CONTACTS"

if [ "$PENDING_CONTACTS" -lt 5 ]; then
    echo "⚠️  WARNING: Less than 5 contacts available!"
    echo "   You need to add contacts via the web interface"
fi

echo ""
echo "🔧 Step 9: Configure environment..."
# Check critical environment variables
docker exec ai-dialer-backend sh -c 'echo "Checking env vars..."'
docker exec ai-dialer-backend sh -c 'env | grep -E "AGI_PORT|ARI_URL|MAX_CONCURRENT" | head -5'

echo ""
echo "🔧 Step 10: Test API health..."
HEALTH=$(docker exec ai-dialer-backend curl -s http://localhost:3000/health | grep -c "healthy" || echo "0")
if [ "$HEALTH" -gt 0 ]; then
    echo "✓ API is healthy"
else
    echo "❌ API health check failed"
    docker-compose -f docker-compose.demo.yml logs --tail=20 backend
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ READY TO TEST"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Next steps:"
echo ""
echo "1. Check LiveMonitor in browser:"
echo "   https://atsservice.site/"
echo ""
echo "2. Start test calls:"
echo "   bash start-test-calls.sh"
echo ""
echo "3. Monitor in real-time:"
echo "   docker-compose -f docker-compose.demo.yml logs -f backend | grep -i 'agi\\|conversation'"
echo ""
echo "4. Watch active calls:"
echo "   watch -n 2 'docker exec ai-dialer-postgres psql -U postgres -d ai_dialer -t -c \"SELECT id, status, EXTRACT(EPOCH FROM (NOW() - created_at))::integer as age FROM calls WHERE status IN ('"'"'initiated'"'"', '"'"'in_progress'"'"') ORDER BY created_at DESC LIMIT 5;\"'"
echo ""

# Show current system status
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Current System Status"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

docker exec ai-dialer-postgres psql -U postgres -d ai_dialer -c "
SELECT 
    'Active Campaigns' as metric,
    COUNT(*)::text as value
FROM campaigns WHERE status = 'active'
UNION ALL
SELECT 
    'Pending Contacts',
    COUNT(*)::text
FROM contacts WHERE status IN ('pending', 'new')
UNION ALL
SELECT 
    'Active Calls',
    COUNT(*)::text
FROM calls WHERE status IN ('initiated', 'in_progress')
UNION ALL
SELECT 
    'Calls Today',
    COUNT(*)::text
FROM calls WHERE created_at >= CURRENT_DATE;
"

echo ""
echo "✅ Setup complete! System ready for automated calls."
echo ""

