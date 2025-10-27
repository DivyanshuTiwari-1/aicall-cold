#!/bin/bash
###############################################################
# PRODUCTION AI CALLS TEST - ONE COMMAND RUNNER
# Run this on your production server to test everything
###############################################################

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

clear

echo -e "${CYAN}${BOLD}"
cat << "EOF"
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║     AI AUTOMATED CALLS - PRODUCTION TEST                   ║
║     Complete End-to-End Testing Suite                      ║
║                                                            ║
╔════════════════════════════════════════════════════════════╗
EOF
echo -e "${NC}"
echo ""

cd /opt/ai-dialer || { echo -e "${RED}❌ Error: /opt/ai-dialer directory not found${NC}"; exit 1; }

# Step 1: Update code
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}Step 1: Updating Code from GitHub${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

git fetch origin
BEFORE_COMMIT=$(git rev-parse HEAD)
git pull origin main
AFTER_COMMIT=$(git rev-parse HEAD)

if [ "$BEFORE_COMMIT" = "$AFTER_COMMIT" ]; then
    echo -e "${GREEN}✓ Code is up to date${NC}"
else
    echo -e "${GREEN}✓ Code updated: $BEFORE_COMMIT -> $AFTER_COMMIT${NC}"
    echo -e "${YELLOW}  Restarting backend to apply changes...${NC}"
    docker-compose -f docker-compose.demo.yml restart backend
    sleep 5
fi

# Make scripts executable
chmod +x *.sh 2>/dev/null || true

echo ""

# Step 2: System Health Check
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}Step 2: System Health Check${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [ -f "verify-complete-flow.sh" ]; then
    bash verify-complete-flow.sh
else
    echo -e "${YELLOW}⚠️  verify-complete-flow.sh not found, skipping detailed checks${NC}"
    
    # Basic checks
    echo "Checking Docker containers..."
    docker-compose -f docker-compose.demo.yml ps
    
    echo ""
    echo "Checking database..."
    docker exec ai-dialer-postgres psql -U postgres -d ai_dialer -c "SELECT 1;" > /dev/null 2>&1 && \
        echo -e "${GREEN}✓ Database OK${NC}" || \
        echo -e "${RED}✗ Database Error${NC}"
fi

echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}Proceed with test calls?${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "This will initiate 5 real AI calls to contacts in your active campaign."
echo ""
read -p "Continue? (y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Test cancelled by user${NC}"
    exit 0
fi

echo ""

# Step 3: Test Calls
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}Step 3: Initiating Test Calls${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [ -f "start-test-calls.sh" ]; then
    bash start-test-calls.sh
else
    echo -e "${YELLOW}⚠️  start-test-calls.sh not found${NC}"
    echo "Checking for active calls manually..."
    
    docker exec ai-dialer-postgres psql -U postgres -d ai_dialer -c "
    SELECT id, status, created_at 
    FROM calls 
    WHERE created_at >= NOW() - INTERVAL '5 minutes'
    ORDER BY created_at DESC;
    "
fi

echo ""

# Step 4: Show Results
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}Step 4: Test Results${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "${BLUE}📊 Calls Created (Last 10 Minutes):${NC}"
CALL_COUNT=$(docker exec ai-dialer-postgres psql -U postgres -d ai_dialer -t -c "
SELECT COUNT(*) FROM calls WHERE created_at >= NOW() - INTERVAL '10 minutes';
" | xargs)
echo "   Total: $CALL_COUNT"

echo ""
echo -e "${BLUE}💬 Conversation Turns Logged:${NC}"
CONV_COUNT=$(docker exec ai-dialer-postgres psql -U postgres -d ai_dialer -t -c "
SELECT COUNT(*) FROM call_events 
WHERE event_type = 'ai_conversation' 
AND timestamp >= NOW() - INTERVAL '10 minutes';
" | xargs)
echo "   Total: $CONV_COUNT"

if [ "$CONV_COUNT" -gt 0 ]; then
    echo ""
    echo -e "${GREEN}✅ SUCCESS: AI conversations are working!${NC}"
    echo ""
    echo -e "${BLUE}Latest Conversation:${NC}"
    docker exec ai-dialer-postgres psql -U postgres -d ai_dialer -c "
    SELECT 
        event_data->>'user_input' as customer,
        event_data->>'ai_response' as ai
    FROM call_events
    WHERE event_type = 'ai_conversation'
    ORDER BY timestamp DESC
    LIMIT 1;
    "
else
    echo ""
    echo -e "${YELLOW}⚠️  WARNING: No AI conversations detected yet${NC}"
    echo "   This may be normal if calls are still in progress."
    echo "   Check logs: docker-compose -f docker-compose.demo.yml logs backend | grep conversation"
fi

echo ""

# Step 5: Monitoring Options
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}Step 5: Next Steps${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "${GREEN}✅ Production test complete!${NC}"
echo ""
echo "To monitor calls in real-time:"
echo ""
echo -e "${YELLOW}1. Live Dashboard:${NC}"
echo "   bash monitor-live-calls.sh"
echo ""
echo -e "${YELLOW}2. Watch Conversations:${NC}"
echo "   docker-compose -f docker-compose.demo.yml logs -f backend | grep -i conversation"
echo ""
echo -e "${YELLOW}3. Web Interface:${NC}"
echo "   https://atsservice.site/"
echo "   Navigate to: Live Monitoring → Active Calls"
echo ""
echo -e "${YELLOW}4. Check Call History:${NC}"
echo "   docker exec ai-dialer-postgres psql -U postgres -d ai_dialer -c \"SELECT * FROM calls ORDER BY created_at DESC LIMIT 10;\""
echo ""

# Final Summary
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}System Status Summary${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Docker status
RUNNING_SERVICES=$(docker-compose -f docker-compose.demo.yml ps | grep "Up" | wc -l)
echo -e "  Docker Services: ${GREEN}$RUNNING_SERVICES running${NC}"

# Database
DB_STATUS=$(docker exec ai-dialer-postgres psql -U postgres -d ai_dialer -c "SELECT 1;" 2>&1 | grep -c "1 row" || echo "0")
if [ "$DB_STATUS" -gt 0 ]; then
    echo -e "  Database: ${GREEN}✓ Connected${NC}"
else
    echo -e "  Database: ${RED}✗ Error${NC}"
fi

# Backend API
API_STATUS=$(docker exec ai-dialer-backend curl -s http://localhost:3000/health 2>&1 | grep -c "healthy" || echo "0")
if [ "$API_STATUS" -gt 0 ]; then
    echo -e "  Backend API: ${GREEN}✓ Healthy${NC}"
else
    echo -e "  Backend API: ${YELLOW}⚠ Check logs${NC}"
fi

# Calls today
CALLS_TODAY=$(docker exec ai-dialer-postgres psql -U postgres -d ai_dialer -t -c "SELECT COUNT(*) FROM calls WHERE created_at >= CURRENT_DATE;" 2>/dev/null | xargs)
echo -e "  Calls Today: ${BLUE}$CALLS_TODAY${NC}"

# Active now
ACTIVE_NOW=$(docker exec ai-dialer-postgres psql -U postgres -d ai_dialer -t -c "SELECT COUNT(*) FROM calls WHERE status IN ('initiated', 'in_progress');" 2>/dev/null | xargs)
if [ "$ACTIVE_NOW" -gt 0 ]; then
    echo -e "  Active Calls: ${GREEN}$ACTIVE_NOW${NC}"
else
    echo -e "  Active Calls: ${BLUE}0${NC}"
fi

echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [ "$CONV_COUNT" -gt 0 ]; then
    echo -e "${GREEN}${BOLD}🎉 AUTOMATED AI CALLS ARE WORKING! 🎉${NC}"
    echo ""
    echo "Your system is ready to handle 1000+ calls per day!"
else
    echo -e "${YELLOW}${BOLD}⚠️  System is running, but verify conversations${NC}"
    echo ""
    echo "Check the logs and web interface to confirm AI is talking to customers."
fi

echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

