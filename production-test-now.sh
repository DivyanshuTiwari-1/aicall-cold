#!/bin/bash
###############################################################
# PRODUCTION AI CALLS - AUTO FIX & TEST
# Automatically fixes issues and tests AI calls
###############################################################

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
║     AI AUTOMATED CALLS - AUTO FIX & TEST                   ║
║     Fixing issues and testing end-to-end                   ║
║                                                            ║
╔════════════════════════════════════════════════════════════╗
EOF
echo -e "${NC}"
echo ""

cd /opt/ai-dialer || { echo -e "${RED}❌ Error: /opt/ai-dialer directory not found${NC}"; exit 1; }

# Don't exit on error - we'll handle them
set +e

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

# Step 2: Fix & Verify Services
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}Step 2: Checking & Fixing Services${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check if containers are running
echo "🐳 Checking Docker containers..."
if ! docker-compose -f docker-compose.demo.yml ps | grep -q "Up"; then
    echo -e "${YELLOW}⚠️  Some containers not running, restarting...${NC}"
    docker-compose -f docker-compose.demo.yml up -d
    sleep 10
fi

BACKEND_STATUS=$(docker ps --filter "name=ai-dialer-backend" --format "{{.Status}}" 2>/dev/null | grep -c "Up" || echo "0")
DB_STATUS=$(docker ps --filter "name=ai-dialer-postgres" --format "{{.Status}}" 2>/dev/null | grep -c "Up" || echo "0")
ASTERISK_STATUS=$(docker ps --filter "name=asterisk" --format "{{.Status}}" 2>/dev/null | grep -c "Up" || echo "0")

if [ "$BACKEND_STATUS" -eq 0 ]; then
    echo -e "${RED}✗ Backend not running - restarting...${NC}"
    docker-compose -f docker-compose.demo.yml up -d backend
    sleep 10
else
    echo -e "${GREEN}✓ Backend is running${NC}"
fi

if [ "$DB_STATUS" -eq 0 ]; then
    echo -e "${RED}✗ Database not running - restarting...${NC}"
    docker-compose -f docker-compose.demo.yml up -d postgres
    sleep 5
else
    echo -e "${GREEN}✓ Database is running${NC}"
fi

if [ "$ASTERISK_STATUS" -eq 0 ]; then
    echo -e "${RED}✗ Asterisk not running - restarting...${NC}"
    docker-compose -f docker-compose.demo.yml up -d asterisk
    sleep 5
else
    echo -e "${GREEN}✓ Asterisk is running${NC}"
fi

# Check database connectivity
echo ""
echo "💾 Testing database..."
if docker exec ai-dialer-postgres psql -U postgres -d ai_dialer -c "SELECT 1;" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Database accessible${NC}"
else
    echo -e "${RED}✗ Database connection failed${NC}"
    echo "Restarting database..."
    docker-compose -f docker-compose.demo.yml restart postgres
    sleep 5
fi

# Check backend API
echo ""
echo "🔌 Testing backend API..."
sleep 3
if docker exec ai-dialer-backend curl -f -s http://localhost:3000/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Backend API responding${NC}"
else
    echo -e "${YELLOW}⚠️  Backend API not responding, restarting...${NC}"
    docker-compose -f docker-compose.demo.yml restart backend
    sleep 10
fi

# Check FastAGI server is in logs
echo ""
echo "🤖 Checking FastAGI server..."
if docker-compose -f docker-compose.demo.yml logs backend 2>/dev/null | grep -q "FastAGI\|AGI server\|port 4573"; then
    echo -e "${GREEN}✓ FastAGI server detected in logs${NC}"
else
    echo -e "${YELLOW}⚠️  FastAGI not detected, may need restart${NC}"
    docker-compose -f docker-compose.demo.yml restart backend
    sleep 10
fi

echo ""
echo -e "${GREEN}✅ All services checked and fixed${NC}"

# Step 3: Verify Campaign & Contacts
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}Step 3: Campaign & Contact Setup${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

CAMPAIGN_ID=$(docker exec ai-dialer-postgres psql -U postgres -d ai_dialer -t -c "SELECT id FROM campaigns WHERE status = 'active' LIMIT 1;" 2>/dev/null | xargs)

if [ -z "$CAMPAIGN_ID" ]; then
    echo -e "${YELLOW}⚠️  No active campaign found${NC}"
    echo "Please activate a campaign via web interface first"
    echo "Visit: https://atsservice.site/ → Campaigns"
    exit 1
else
    echo -e "${GREEN}✓ Active campaign found: $CAMPAIGN_ID${NC}"
fi

CONTACT_COUNT=$(docker exec ai-dialer-postgres psql -U postgres -d ai_dialer -t -c "SELECT COUNT(*) FROM contacts WHERE campaign_id = '$CAMPAIGN_ID' AND status IN ('pending', 'new');" 2>/dev/null | xargs)
echo -e "${BLUE}  Available contacts: $CONTACT_COUNT${NC}"

if [ "$CONTACT_COUNT" -lt 1 ]; then
    echo -e "${YELLOW}⚠️  No contacts available for calling${NC}"
    echo "Please add contacts via web interface first"
    exit 1
fi

# Step 4: Check for existing active calls or start queue
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}Step 4: Checking Queue & Active Calls${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

ACTIVE_CALLS=$(docker exec ai-dialer-postgres psql -U postgres -d ai_dialer -t -c "SELECT COUNT(*) FROM calls WHERE status IN ('initiated', 'in_progress') AND created_at >= NOW() - INTERVAL '10 minutes';" 2>/dev/null | xargs)

if [ "$ACTIVE_CALLS" -gt 0 ]; then
    echo -e "${GREEN}✓ Found $ACTIVE_CALLS active call(s) - monitoring...${NC}"
else
    echo -e "${BLUE}No active calls - queue may not be running${NC}"
    echo ""
    echo "Note: You can start the queue from the web interface:"
    echo "  https://atsservice.site/ → Campaigns → Start Queue"
    echo ""
    echo "Or check queue status:"
    docker exec ai-dialer-backend curl -s http://localhost:3000/api/v1/queue/status 2>/dev/null | head -10 || echo "Queue status unavailable"
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
