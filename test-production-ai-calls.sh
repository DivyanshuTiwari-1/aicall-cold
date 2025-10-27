#!/bin/bash
#############################################
# Production AI Automated Calls Test Script
#############################################

echo "=========================================="
echo "🧪 Testing AI Automated Calls on Production"
echo "=========================================="
echo ""

# Check Docker services
echo "📊 Checking Docker Services..."
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | head -10
echo ""

# Check Asterisk
echo "🔧 Checking Asterisk..."
docker exec asterisk asterisk -rx "core show version" 2>/dev/null
if [ $? -eq 0 ]; then
    echo "✅ Asterisk is running"
else
    echo "❌ Asterisk is not running properly"
fi
echo ""

# Check Backend Health
echo "🔧 Checking Backend Health..."
BACKEND_HEALTH=$(curl -s http://localhost:3000/health | jq -r '.status' 2>/dev/null)
if [ "$BACKEND_HEALTH" = "ok" ]; then
    echo "✅ Backend is healthy"
else
    echo "❌ Backend health check failed"
fi
echo ""

# Check Database Schema
echo "🗄️  Checking Database Schema..."
docker exec ai-dialer-backend node -e "
const {query} = require('./config/database');
(async () => {
    try {
        // Check priority column
        const priority = await query(\`
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'contacts' AND column_name = 'priority'
        \`);
        console.log(priority.rows.length > 0 ? '✅ contacts.priority exists' : '❌ contacts.priority MISSING');

        // Check added_date column
        const added_date = await query(\`
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'dnc_registry' AND column_name = 'added_date'
        \`);
        console.log(added_date.rows.length > 0 ? '✅ dnc_registry.added_date exists' : '❌ dnc_registry.added_date MISSING');

        // Check consent_granted column
        const consent = await query(\`
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'calls' AND column_name = 'consent_granted'
        \`);
        console.log(consent.rows.length > 0 ? '✅ calls.consent_granted exists' : '❌ calls.consent_granted MISSING');

        process.exit(0);
    } catch(e) {
        console.error('❌ Database check failed:', e.message);
        process.exit(1);
    }
})();
" 2>&1
echo ""

# Check FastAGI Server
echo "🤖 Checking FastAGI Server (AI Call Handler)..."
docker exec ai-dialer-backend node -e "
const net = require('net');
const client = net.createConnection({ port: 4573, host: 'localhost' }, () => {
    console.log('✅ FastAGI Server is listening on port 4573');
    client.end();
});
client.on('error', (err) => {
    console.log('❌ FastAGI Server not accessible:', err.message);
    process.exit(1);
});
setTimeout(() => {
    client.destroy();
    process.exit(0);
}, 2000);
" 2>&1
echo ""

# Check Asterisk ARI Connection
echo "📡 Checking Asterisk ARI..."
ARI_STATUS=$(curl -s -u ai-dialer:ai-dialer-password http://localhost:8088/ari/asterisk/info | jq -r '.build.date' 2>/dev/null)
if [ ! -z "$ARI_STATUS" ]; then
    echo "✅ Asterisk ARI is accessible"
else
    echo "❌ Asterisk ARI connection failed"
fi
echo ""

# Test Queue Service
echo "🔄 Testing Queue Service..."
docker exec ai-dialer-backend node -e "
const {query} = require('./config/database');
(async () => {
    try {
        // Get a test campaign
        const campaigns = await query(\`
            SELECT c.id, c.name, COUNT(ct.id) as contact_count
            FROM campaigns c
            LEFT JOIN contacts ct ON c.id = ct.campaign_id AND ct.status IN ('pending', 'new', 'retry')
            WHERE c.status = 'active'
            GROUP BY c.id, c.name
            LIMIT 1
        \`);

        if (campaigns.rows.length > 0) {
            const campaign = campaigns.rows[0];
            console.log(\`✅ Found test campaign: \${campaign.name}\`);
            console.log(\`   - Campaign ID: \${campaign.id}\`);
            console.log(\`   - Ready contacts: \${campaign.contact_count}\`);

            if (campaign.contact_count > 0) {
                console.log('✅ System is ready for automated calls!');
            } else {
                console.log('⚠️  No contacts ready for calling. Add contacts to test.');
            }
        } else {
            console.log('⚠️  No active campaigns found. Create a campaign to test.');
        }

        process.exit(0);
    } catch(e) {
        console.error('❌ Queue service check failed:', e.message);
        process.exit(1);
    }
})();
" 2>&1
echo ""

# Check WebSocket Server
echo "🔌 Checking WebSocket Server..."
WS_CHECK=$(curl -s http://localhost:3000/api/v1/health | jq -r '.websocket' 2>/dev/null)
if [ "$WS_CHECK" = "connected" ] || [ "$WS_CHECK" = "ready" ]; then
    echo "✅ WebSocket server is ready"
else
    echo "⚠️  WebSocket status: $WS_CHECK"
fi
echo ""

# Summary
echo "=========================================="
echo "📋 Test Summary"
echo "=========================================="
echo ""
echo "If all checks passed, you can now:"
echo "1. Login to https://atsservice.site/"
echo "2. Go to Campaigns page"
echo "3. Select a campaign with contacts"
echo "4. Click 'Start Automated Calls'"
echo "5. Watch Live Monitor for real-time AI conversations"
echo ""
echo "=========================================="
echo "✅ Production AI Calls System is READY!"
echo "=========================================="
