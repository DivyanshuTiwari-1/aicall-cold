#!/bin/bash
#################################################
# Start 5 Test AI Calls Script
# Initiates automated calls and monitors progress
#################################################

set -e

echo "╔════════════════════════════════════════════════╗"
echo "║   Starting 5 Test AI Calls                    ║"
echo "╔════════════════════════════════════════════════╗"
echo ""

cd /opt/ai-dialer || { echo "❌ Cannot find /opt/ai-dialer"; exit 1; }

# Get campaign ID
CAMPAIGN_ID=$(docker exec ai-dialer-postgres psql -U postgres -d ai_dialer -t -c "
SELECT id FROM campaigns WHERE status = 'active' LIMIT 1;
" | xargs)

if [ -z "$CAMPAIGN_ID" ]; then
    echo "❌ No active campaign found!"
    echo "Please activate a campaign first"
    exit 1
fi

echo "✓ Using Campaign ID: $CAMPAIGN_ID"
echo ""

# Check contacts
CONTACT_COUNT=$(docker exec ai-dialer-postgres psql -U postgres -d ai_dialer -t -c "
SELECT COUNT(*) FROM contacts 
WHERE campaign_id = '$CAMPAIGN_ID' 
AND status IN ('pending', 'new');
" | xargs)

echo "📊 Contacts available for calling: $CONTACT_COUNT"

if [ "$CONTACT_COUNT" -lt 5 ]; then
    echo "⚠️  Warning: Only $CONTACT_COUNT contacts available (need 5)"
    echo "   Proceeding with available contacts..."
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 Starting Queue"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Get auth token (you'll need to replace these with actual credentials)
echo "Getting auth token..."
AUTH_RESPONSE=$(docker exec ai-dialer-backend curl -s http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}')

TOKEN=$(echo "$AUTH_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('token', ''))" 2>/dev/null)

if [ -z "$TOKEN" ]; then
    echo "❌ Failed to get auth token"
    echo "Response: $AUTH_RESPONSE"
    echo ""
    echo "💡 Try logging in via the web interface first"
    exit 1
fi

echo "✓ Authenticated successfully"
echo ""

# Start queue
echo "Starting automated call queue..."
QUEUE_RESPONSE=$(docker exec ai-dialer-backend curl -s http://localhost:3000/api/v1/queue/start/$CAMPAIGN_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -X POST)

echo "$QUEUE_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$QUEUE_RESPONSE"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Monitoring Calls (Press Ctrl+C to stop)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Monitor calls for 5 minutes or until 5 calls complete
START_TIME=$(date +%s)
CALL_COUNT=0
MAX_WAIT=300  # 5 minutes

while [ $CALL_COUNT -lt 5 ]; do
    CURRENT_TIME=$(date +%s)
    ELAPSED=$((CURRENT_TIME - START_TIME))
    
    if [ $ELAPSED -gt $MAX_WAIT ]; then
        echo "⏱️  Timeout reached (5 minutes)"
        break
    fi
    
    # Check active and completed calls
    STATS=$(docker exec ai-dialer-postgres psql -U postgres -d ai_dialer -t -c "
    SELECT 
        COUNT(CASE WHEN status IN ('initiated', 'in_progress') THEN 1 END) as active,
        COUNT(CASE WHEN status = 'completed' AND created_at >= NOW() - INTERVAL '5 minutes' THEN 1 END) as completed
    FROM calls
    WHERE campaign_id = '$CAMPAIGN_ID';
    ")
    
    ACTIVE=$(echo "$STATS" | awk '{print $1}')
    COMPLETED=$(echo "$STATS" | awk '{print $3}')
    CALL_COUNT=$COMPLETED
    
    clear
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "📞 Live Call Monitoring - $(date '+%H:%M:%S')"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "   Active Calls: $ACTIVE"
    echo "   Completed: $COMPLETED / 5"
    echo "   Time Elapsed: ${ELAPSED}s"
    echo ""
    
    # Show active calls
    echo "🔥 Active Calls:"
    docker exec ai-dialer-postgres psql -U postgres -d ai_dialer -t -c "
    SELECT 
        c.id,
        ct.first_name || ' ' || ct.last_name as contact,
        c.status,
        EXTRACT(EPOCH FROM (NOW() - c.created_at))::integer as duration
    FROM calls c
    JOIN contacts ct ON c.contact_id = ct.id
    WHERE c.status IN ('initiated', 'in_progress')
    AND c.campaign_id = '$CAMPAIGN_ID'
    ORDER BY c.created_at DESC;
    " || echo "   None"
    
    echo ""
    echo "✅ Completed Calls (Last 5):"
    docker exec ai-dialer-postgres psql -U postgres -d ai_dialer -t -c "
    SELECT 
        ct.first_name || ' ' || ct.last_name as contact,
        c.outcome,
        c.duration || 's' as duration
    FROM calls c
    JOIN contacts ct ON c.contact_id = ct.id
    WHERE c.status = 'completed'
    AND c.campaign_id = '$CAMPAIGN_ID'
    AND c.created_at >= NOW() - INTERVAL '10 minutes'
    ORDER BY c.created_at DESC
    LIMIT 5;
    " || echo "   None yet"
    
    echo ""
    echo "💬 Latest Conversation Turn:"
    docker exec ai-dialer-postgres psql -U postgres -d ai_dialer -t -c "
    SELECT 
        ce.event_data->>'user_input' as customer,
        ce.event_data->>'ai_response' as ai
    FROM call_events ce
    WHERE ce.event_type = 'ai_conversation'
    AND ce.call_id IN (
        SELECT id FROM calls 
        WHERE campaign_id = '$CAMPAIGN_ID' 
        AND created_at >= NOW() - INTERVAL '10 minutes'
    )
    ORDER BY ce.timestamp DESC
    LIMIT 1;
    " || echo "   No conversations yet"
    
    sleep 3
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Final Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

docker exec ai-dialer-postgres psql -U postgres -d ai_dialer -c "
SELECT 
    outcome,
    COUNT(*) as count,
    ROUND(AVG(duration), 2) as avg_duration,
    SUM(cost) as total_cost
FROM calls
WHERE campaign_id = '$CAMPAIGN_ID'
AND created_at >= NOW() - INTERVAL '10 minutes'
GROUP BY outcome;
"

echo ""
echo "✅ Test Complete!"
echo ""
echo "To view detailed conversation logs:"
echo "  docker exec ai-dialer-postgres psql -U postgres -d ai_dialer -c \"SELECT * FROM call_events WHERE event_type = 'ai_conversation' ORDER BY timestamp DESC LIMIT 20;\""
echo ""

