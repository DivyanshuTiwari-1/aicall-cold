#!/bin/bash
#################################################
# Live AI Calls Testing & Monitoring Script
# Tests complete automated call flow
#################################################

set -e

echo "╔════════════════════════════════════════════════╗"
echo "║   AI Automated Calls - Live Testing            ║"
echo "╔════════════════════════════════════════════════╗"
echo ""

cd /opt/ai-dialer || { echo "❌ Cannot find /opt/ai-dialer"; exit 1; }

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 STEP 1: System Health Check"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check containers
echo "🐳 Docker Containers:"
docker-compose -f docker-compose.demo.yml ps

# Check critical services
echo ""
echo "🔍 Service Status:"
services=("ai-dialer-backend" "ai-dialer-postgres" "asterisk")
for service in "${services[@]}"; do
    if docker ps | grep -q "$service"; then
        echo -e "${GREEN}✓${NC} $service: Running"
    else
        echo -e "${RED}✗${NC} $service: NOT RUNNING"
    fi
done

# Check FastAGI Server
echo ""
echo "🤖 FastAGI Server Status:"
docker exec ai-dialer-backend sh -c "netstat -tuln | grep 4573" 2>/dev/null && \
    echo -e "${GREEN}✓${NC} FastAGI listening on port 4573" || \
    echo -e "${YELLOW}⚠${NC}  FastAGI not detected (may not have netstat)"

# Check Asterisk ARI
echo ""
echo "📞 Asterisk ARI Status:"
docker exec asterisk sh -c "asterisk -rx 'ari show status'" 2>/dev/null || \
    echo -e "${YELLOW}⚠${NC}  Could not check ARI status"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 STEP 2: Campaign & Contact Check"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "📊 Active Campaigns:"
docker exec ai-dialer-postgres psql -U postgres -d ai_dialer -t -c "
SELECT 
    c.name,
    c.status,
    COUNT(ct.id) as contacts,
    COUNT(CASE WHEN ct.status = 'pending' THEN 1 END) as pending_calls
FROM campaigns c
LEFT JOIN contacts ct ON c.id = ct.campaign_id
WHERE c.status = 'active'
GROUP BY c.id, c.name, c.status;
" || echo -e "${RED}✗${NC} Could not query campaigns"

echo ""
echo "📞 Contact Status Breakdown:"
docker exec ai-dialer-postgres psql -U postgres -d ai_dialer -t -c "
SELECT 
    status,
    COUNT(*) as count
FROM contacts
WHERE campaign_id IN (SELECT id FROM campaigns WHERE status = 'active')
GROUP BY status
ORDER BY count DESC;
"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔥 STEP 3: Current Active Calls"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "📞 Active/In-Progress Calls:"
ACTIVE_CALLS=$(docker exec ai-dialer-postgres psql -U postgres -d ai_dialer -t -c "
SELECT 
    c.id,
    c.status,
    c.call_type,
    ct.first_name || ' ' || ct.last_name as contact_name,
    ct.phone,
    EXTRACT(EPOCH FROM (NOW() - c.created_at))::integer as duration_seconds,
    c.created_at
FROM calls c
JOIN contacts ct ON c.contact_id = ct.id
WHERE c.status IN ('initiated', 'in_progress', 'ringing', 'connected')
ORDER BY c.created_at DESC
LIMIT 10;
")

if [ -z "$ACTIVE_CALLS" ]; then
    echo -e "${YELLOW}⚠${NC}  No active calls right now"
else
    echo "$ACTIVE_CALLS"
fi

echo ""
echo "📊 Recent Call Statistics (Last 10 calls):"
docker exec ai-dialer-postgres psql -U postgres -d ai_dialer -t -c "
SELECT 
    status,
    outcome,
    call_type,
    duration,
    created_at
FROM calls
ORDER BY created_at DESC
LIMIT 10;
"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "💬 STEP 4: AI Conversation Logs"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "🗣️ Latest AI Conversations (Last 5 turns):"
docker exec ai-dialer-postgres psql -U postgres -d ai_dialer -t -c "
SELECT 
    ce.call_id,
    ce.event_data->>'user_input' as customer,
    ce.event_data->>'ai_response' as ai,
    ce.timestamp
FROM call_events ce
WHERE ce.event_type = 'ai_conversation'
ORDER BY ce.timestamp DESC
LIMIT 5;
" || echo -e "${YELLOW}⚠${NC}  No conversation logs yet"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔧 STEP 5: Queue Status"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "📡 Checking queue status via API..."
QUEUE_STATUS=$(docker exec ai-dialer-backend curl -s http://localhost:3000/api/v1/queue/status 2>/dev/null || echo "{}")
echo "$QUEUE_STATUS" | python3 -m json.tool 2>/dev/null || echo "$QUEUE_STATUS"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📝 STEP 6: System Logs (Last 20 lines)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "🔍 Backend Logs (FastAGI & Conversation):"
docker-compose -f docker-compose.demo.yml logs --tail=20 backend | grep -E "AGI|FastAGI|conversation|Conversation" || \
    docker-compose -f docker-compose.demo.yml logs --tail=20 backend

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎯 STEP 7: Performance Metrics"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "📊 Call Volume & Success Rate:"
docker exec ai-dialer-postgres psql -U postgres -d ai_dialer -t -c "
SELECT 
    DATE(created_at) as date,
    COUNT(*) as total_calls,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
    COUNT(CASE WHEN call_type = 'automated' THEN 1 END) as automated,
    ROUND(AVG(duration), 2) as avg_duration_sec,
    SUM(cost) as total_cost
FROM calls
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY DATE(created_at)
ORDER BY date DESC;
"

echo ""
echo "🚀 System Capacity:"
echo "   Max Concurrent Calls: ${MAX_CONCURRENT_CALLS:-5}"
echo "   Call Interval: ${CALL_INTERVAL_MS:-30000}ms"
echo "   Daily Capacity: ~$((86400000 / ${CALL_INTERVAL_MS:-30000})) calls/day"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ STEP 8: Health Check Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Count active services
RUNNING_SERVICES=$(docker-compose -f docker-compose.demo.yml ps | grep "Up" | wc -l)
TOTAL_SERVICES=$(docker-compose -f docker-compose.demo.yml ps | tail -n +3 | wc -l)

# Check database connection
DB_CHECK=$(docker exec ai-dialer-postgres psql -U postgres -d ai_dialer -c "SELECT 1;" 2>&1 | grep -c "1 row" || echo "0")

# Check backend API
API_CHECK=$(docker exec ai-dialer-backend curl -s http://localhost:3000/health 2>&1 | grep -c "healthy" || echo "0")

echo "System Status:"
echo -e "  Docker Services: ${GREEN}$RUNNING_SERVICES/$TOTAL_SERVICES${NC} running"
echo -e "  Database: $([ "$DB_CHECK" -gt 0 ] && echo "${GREEN}✓${NC} Connected" || echo "${RED}✗${NC} Error")"
echo -e "  Backend API: $([ "$API_CHECK" -gt 0 ] && echo "${GREEN}✓${NC} Healthy" || echo "${RED}✗${NC} Error")"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎬 STEP 9: Live Monitoring Commands"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

cat << 'EOF'
To monitor calls in real-time, use these commands:

1. Watch Active Calls:
   watch -n 2 'docker exec ai-dialer-postgres psql -U postgres -d ai_dialer -t -c "SELECT id, status, EXTRACT(EPOCH FROM (NOW() - created_at))::integer as age FROM calls WHERE status IN ('"'"'initiated'"'"', '"'"'in_progress'"'"') ORDER BY created_at DESC LIMIT 5;"'

2. Monitor Conversation Turns:
   docker-compose -f docker-compose.demo.yml logs -f backend | grep -i "conversation"

3. Watch FastAGI Activity:
   docker-compose -f docker-compose.demo.yml logs -f backend | grep -i "agi"

4. Monitor Asterisk:
   docker exec asterisk asterisk -rx "core show channels verbose"

5. Check Queue Status:
   docker exec ai-dialer-backend curl http://localhost:3000/api/v1/queue/status

EOF

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Testing Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

