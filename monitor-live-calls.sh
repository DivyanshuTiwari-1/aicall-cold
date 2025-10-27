#!/bin/bash
#################################################
# Live Call Monitoring Dashboard
# Real-time view of active AI conversations
#################################################

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

cd /opt/ai-dialer || exit 1

# Trap Ctrl+C
trap 'echo -e "\n\n${CYAN}Monitoring stopped.${NC}\n"; exit 0' INT

echo -e "${CYAN}"
echo "╔════════════════════════════════════════════════╗"
echo "║      LIVE AI CALL MONITORING DASHBOARD        ║"
echo "║      Press Ctrl+C to exit                     ║"
echo "╔════════════════════════════════════════════════╗"
echo -e "${NC}"
echo ""

while true; do
    clear

    # Header
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}  AI CALL MONITORING - $(date '+%Y-%m-%d %H:%M:%S')${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""

    # Quick Stats
    echo -e "${BLUE}📊 QUICK STATS${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    STATS=$(docker exec ai-dialer-postgres psql -U postgres -d ai_dialer -t -c "
    SELECT
        COUNT(CASE WHEN status IN ('initiated', 'in_progress', 'ringing') THEN 1 END) as active,
        COUNT(CASE WHEN status = 'completed' AND created_at >= NOW() - INTERVAL '1 hour' THEN 1 END) as completed_hour,
        COUNT(CASE WHEN status = 'completed' AND created_at >= CURRENT_DATE THEN 1 END) as completed_today,
        COUNT(CASE WHEN status = 'failed' AND created_at >= NOW() - INTERVAL '1 hour' THEN 1 END) as failed_hour
    FROM calls;
    " 2>/dev/null)

    ACTIVE=$(echo "$STATS" | awk '{print $1}')
    COMPLETED_HOUR=$(echo "$STATS" | awk '{print $3}')
    COMPLETED_TODAY=$(echo "$STATS" | awk '{print $5}')
    FAILED_HOUR=$(echo "$STATS" | awk '{print $7}')

    echo -e "  ${GREEN}Active Now:${NC}      $ACTIVE calls"
    echo -e "  ${CYAN}Last Hour:${NC}       $COMPLETED_HOUR completed, $FAILED_HOUR failed"
    echo -e "  ${BLUE}Today Total:${NC}     $COMPLETED_TODAY calls"
    echo ""

    # Active Calls Details
    echo -e "${GREEN}🔥 ACTIVE CALLS${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    ACTIVE_CALLS=$(docker exec ai-dialer-postgres psql -U postgres -d ai_dialer -t -c "
    SELECT
        c.id,
        COALESCE(ct.first_name || ' ' || ct.last_name, 'Unknown') as contact,
        SUBSTRING(ct.phone, 1, 12) as phone,
        c.status,
        EXTRACT(EPOCH FROM (NOW() - c.created_at))::integer as duration,
        COALESCE((
            SELECT COUNT(*)
            FROM call_events ce
            WHERE ce.call_id = c.id
            AND ce.event_type = 'ai_conversation'
        ), 0) as turns
    FROM calls c
    LEFT JOIN contacts ct ON c.contact_id = ct.id
    WHERE c.status IN ('initiated', 'in_progress', 'ringing', 'connected')
    ORDER BY c.created_at DESC
    LIMIT 10;
    " 2>/dev/null)

    if [ -z "$ACTIVE_CALLS" ]; then
        echo "  No active calls right now"
    else
        echo "$ACTIVE_CALLS" | while IFS='|' read -r id contact phone status duration turns; do
            id=$(echo "$id" | xargs)
            contact=$(echo "$contact" | xargs)
            phone=$(echo "$phone" | xargs)
            status=$(echo "$status" | xargs)
            duration=$(echo "$duration" | xargs)
            turns=$(echo "$turns" | xargs)

            echo -e "  ${YELLOW}Call ID:${NC} $id"
            echo -e "  ${CYAN}Contact:${NC} $contact ($phone)"
            echo -e "  ${GREEN}Status:${NC}  $status | ${BLUE}Duration:${NC} ${duration}s | ${CYAN}Turns:${NC} $turns"
            echo "  ────────────────────────────────────────────"
        done
    fi
    echo ""

    # Latest Conversation
    echo -e "${CYAN}💬 LATEST CONVERSATION TURN${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    LATEST_CONV=$(docker exec ai-dialer-postgres psql -U postgres -d ai_dialer -t -c "
    SELECT
        ce.call_id,
        ce.event_data->>'user_input' as customer,
        ce.event_data->>'ai_response' as ai,
        TO_CHAR(ce.timestamp, 'HH24:MI:SS') as time
    FROM call_events ce
    WHERE ce.event_type = 'ai_conversation'
    ORDER BY ce.timestamp DESC
    LIMIT 1;
    " 2>/dev/null)

    if [ -z "$LATEST_CONV" ]; then
        echo "  No conversations yet"
    else
        echo "$LATEST_CONV" | while IFS='|' read -r call_id customer ai time; do
            call_id=$(echo "$call_id" | xargs)
            customer=$(echo "$customer" | xargs | cut -c1-60)
            ai=$(echo "$ai" | xargs | cut -c1-60)
            time=$(echo "$time" | xargs)

            echo -e "  ${YELLOW}Call:${NC} $call_id ${BLUE}at${NC} $time"
            echo -e "  ${GREEN}Customer:${NC} $customer"
            echo -e "  ${CYAN}AI:${NC}       $ai"
        done
    fi
    echo ""

    # Recent Completions
    echo -e "${BLUE}✅ RECENT COMPLETIONS (Last 5)${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    RECENT=$(docker exec ai-dialer-postgres psql -U postgres -d ai_dialer -t -c "
    SELECT
        COALESCE(ct.first_name || ' ' || ct.last_name, 'Unknown') as contact,
        c.outcome,
        c.duration || 's' as duration,
        TO_CHAR(c.updated_at, 'HH24:MI:SS') as time
    FROM calls c
    LEFT JOIN contacts ct ON c.contact_id = ct.id
    WHERE c.status = 'completed'
    ORDER BY c.updated_at DESC
    LIMIT 5;
    " 2>/dev/null)

    if [ -z "$RECENT" ]; then
        echo "  No completed calls yet"
    else
        echo "$RECENT"
    fi
    echo ""

    # Queue Status
    echo -e "${YELLOW}⚙️  QUEUE STATUS${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    QUEUE_INFO=$(docker exec ai-dialer-backend curl -s http://localhost:3000/api/v1/queue/status 2>/dev/null)
    if echo "$QUEUE_INFO" | grep -q "activeQueues\|active"; then
        echo "$QUEUE_INFO" | python3 -m json.tool 2>/dev/null | head -10 || echo "$QUEUE_INFO" | head -5
    else
        echo "  Queue status unavailable"
    fi
    echo ""

    # System Health
    echo -e "${CYAN}🔧 SYSTEM HEALTH${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    # Check containers
    BACKEND_STATUS=$(docker ps --filter "name=ai-dialer-backend" --format "{{.Status}}" 2>/dev/null | head -1)
    ASTERISK_STATUS=$(docker ps --filter "name=asterisk" --format "{{.Status}}" 2>/dev/null | head -1)
    DB_STATUS=$(docker ps --filter "name=ai-dialer-postgres" --format "{{.Status}}" 2>/dev/null | head -1)

    echo -e "  Backend:  ${GREEN}$BACKEND_STATUS${NC}"
    echo -e "  Asterisk: ${GREEN}$ASTERISK_STATUS${NC}"
    echo -e "  Database: ${GREEN}$DB_STATUS${NC}"
    echo ""

    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}Refreshing in 3 seconds... (Ctrl+C to exit)${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

    sleep 3
done
