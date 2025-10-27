#!/bin/bash
#################################################
# Complete Flow Verification Script
# Tests EVERY component of automated AI calls
#################################################

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "╔════════════════════════════════════════════════╗"
echo "║   COMPLETE AI CALL FLOW VERIFICATION          ║"
echo "╔════════════════════════════════════════════════╗"
echo ""

cd /opt/ai-dialer || exit 1

PASSED=0
FAILED=0
WARNINGS=0

pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((PASSED++))
}

fail() {
    echo -e "${RED}✗${NC} $1"
    ((FAILED++))
}

warn() {
    echo -e "${YELLOW}⚠${NC} $1"
    ((WARNINGS++))
}

# ==========================================
# TEST 1: Docker Services
# ==========================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 1: Docker Services"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

SERVICES=("ai-dialer-backend" "ai-dialer-postgres" "asterisk")
for service in "${SERVICES[@]}"; do
    if docker ps | grep -q "$service.*Up"; then
        pass "$service is running"
    else
        fail "$service is NOT running"
    fi
done

# ==========================================
# TEST 2: FastAGI Server (Critical!)
# ==========================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 2: FastAGI Server (Node.js)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if FastAGI process exists
if docker exec ai-dialer-backend ps aux 2>/dev/null | grep -q "node.*index.js"; then
    pass "Node.js process running"
else
    fail "Node.js process not found"
fi

# Check FastAGI port
if docker exec ai-dialer-backend sh -c "netstat -tuln 2>/dev/null | grep -q ':4573' || ss -tuln 2>/dev/null | grep -q ':4573'"; then
    pass "FastAGI listening on port 4573"
else
    warn "Cannot verify FastAGI port (netstat/ss not available)"
fi

# Check backend logs for FastAGI
if docker-compose -f docker-compose.demo.yml logs backend 2>/dev/null | grep -q "FastAGI\|AGI server"; then
    pass "FastAGI server initialized in logs"
else
    warn "FastAGI initialization not found in logs"
fi

# ==========================================
# TEST 3: Database Schema
# ==========================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 3: Database Schema"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

TABLES=("calls" "call_events" "campaigns" "contacts" "organizations")
for table in "${TABLES[@]}"; do
    if docker exec ai-dialer-postgres psql -U postgres -d ai_dialer -c "SELECT 1 FROM $table LIMIT 1;" &>/dev/null; then
        pass "Table '$table' exists and accessible"
    else
        fail "Table '$table' not accessible"
    fi
done

# Check call_events structure
if docker exec ai-dialer-postgres psql -U postgres -d ai_dialer -c "SELECT event_data FROM call_events LIMIT 1;" &>/dev/null; then
    pass "call_events has event_data column (for conversations)"
else
    fail "call_events missing event_data column"
fi

# ==========================================
# TEST 4: Asterisk Configuration
# ==========================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 4: Asterisk Configuration"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check Asterisk is responsive
if docker exec asterisk asterisk -rx "core show version" &>/dev/null; then
    pass "Asterisk CLI responsive"
else
    fail "Asterisk CLI not responding"
fi

# Check ARI status
if docker exec asterisk asterisk -rx "ari show status" 2>/dev/null | grep -q "enabled"; then
    pass "ARI is enabled"
else
    warn "ARI status unclear"
fi

# Check if extensions.conf has FastAGI reference
if docker exec asterisk cat /etc/asterisk/extensions.conf 2>/dev/null | grep -q "agi://atsservices:4573"; then
    pass "extensions.conf configured for FastAGI Node.js"
else
    fail "extensions.conf NOT configured for FastAGI"
fi

# Verify no PHP AGI scripts remain
if docker exec asterisk cat /etc/asterisk/extensions.conf 2>/dev/null | grep -q "\.php"; then
    warn "PHP scripts still referenced in extensions.conf"
else
    pass "No PHP scripts in extensions.conf (clean)"
fi

# ==========================================
# TEST 5: Campaign & Contacts
# ==========================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 5: Campaign & Contacts Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

ACTIVE_CAMPAIGNS=$(docker exec ai-dialer-postgres psql -U postgres -d ai_dialer -t -c "SELECT COUNT(*) FROM campaigns WHERE status = 'active';" 2>/dev/null | xargs)
if [ "$ACTIVE_CAMPAIGNS" -gt 0 ]; then
    pass "Active campaigns found: $ACTIVE_CAMPAIGNS"
else
    fail "No active campaigns"
fi

PENDING_CONTACTS=$(docker exec ai-dialer-postgres psql -U postgres -d ai_dialer -t -c "SELECT COUNT(*) FROM contacts WHERE status IN ('pending', 'new');" 2>/dev/null | xargs)
if [ "$PENDING_CONTACTS" -ge 5 ]; then
    pass "Enough contacts for testing: $PENDING_CONTACTS"
elif [ "$PENDING_CONTACTS" -gt 0 ]; then
    warn "Only $PENDING_CONTACTS contacts available (need 5 for full test)"
else
    fail "No contacts available"
fi

# ==========================================
# TEST 6: Queue System
# ==========================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 6: Queue System"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if queue.js exists
if docker exec ai-dialer-backend test -f /app/services/queue.js; then
    pass "queue.js exists"
else
    fail "queue.js not found"
fi

# Check queue status endpoint
QUEUE_STATUS=$(docker exec ai-dialer-backend curl -s http://localhost:3000/api/v1/queue/status 2>/dev/null)
if echo "$QUEUE_STATUS" | grep -q "queue\|Queue"; then
    pass "Queue status endpoint responding"
    echo "   Status: $QUEUE_STATUS"
else
    warn "Queue status endpoint not responding properly"
fi

# ==========================================
# TEST 7: WebSocket System
# ==========================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 7: WebSocket for Real-Time Updates"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if WebSocket broadcaster exists
if docker exec ai-dialer-backend test -f /app/services/websocket-broadcaster.js; then
    pass "websocket-broadcaster.js exists"
else
    fail "websocket-broadcaster.js not found"
fi

# Check if conversation route broadcasts
if docker exec ai-dialer-backend grep -q "broadcastConversationTurn" /app/routes/conversation-simple.js 2>/dev/null; then
    pass "Conversation route uses WebSocket broadcasting"
else
    fail "Conversation route NOT broadcasting via WebSocket"
fi

# ==========================================
# TEST 8: Conversation Engine
# ==========================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 8: AI Conversation Engine"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check conversation route
if docker exec ai-dialer-backend test -f /app/routes/conversation-simple.js; then
    pass "conversation-simple.js exists"
else
    fail "conversation-simple.js not found"
fi

# Check AI conversation handler in AGI
if docker exec ai-dialer-backend test -f /app/services/agi/ai-conversation-handler.js; then
    pass "ai-conversation-handler.js exists"
else
    fail "ai-conversation-handler.js not found"
fi

# Verify OpenAI/AI service config
if docker exec ai-dialer-backend env 2>/dev/null | grep -q "OPENAI"; then
    pass "OpenAI configuration found"
else
    warn "OpenAI configuration not visible"
fi

# ==========================================
# TEST 9: TTS/STT Services
# ==========================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 9: TTS/STT Services"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check TTS route
if docker exec ai-dialer-backend test -f /app/routes/tts.js; then
    pass "TTS route exists"
else
    fail "TTS route not found"
fi

# Check if Piper TTS is configured
if docker-compose -f docker-compose.demo.yml ps 2>/dev/null | grep -q "piper"; then
    pass "Piper TTS container configured"
else
    warn "Piper TTS container not found (using cloud TTS?)"
fi

# Check transcription service
if docker exec ai-dialer-backend test -f /app/services/transcription.js; then
    pass "Transcription service exists"
else
    warn "Transcription service not found"
fi

# ==========================================
# TEST 10: Historical Data Check
# ==========================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 10: Historical Call Data"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

TOTAL_CALLS=$(docker exec ai-dialer-postgres psql -U postgres -d ai_dialer -t -c "SELECT COUNT(*) FROM calls;" 2>/dev/null | xargs)
echo "   Total calls in database: $TOTAL_CALLS"

AUTOMATED_CALLS=$(docker exec ai-dialer-postgres psql -U postgres -d ai_dialer -t -c "SELECT COUNT(*) FROM calls WHERE call_type = 'automated';" 2>/dev/null | xargs)
echo "   Automated calls: $AUTOMATED_CALLS"

CONV_EVENTS=$(docker exec ai-dialer-postgres psql -U postgres -d ai_dialer -t -c "SELECT COUNT(*) FROM call_events WHERE event_type = 'ai_conversation';" 2>/dev/null | xargs)
if [ "$CONV_EVENTS" -gt 0 ]; then
    pass "Conversation events logged: $CONV_EVENTS"
else
    warn "No conversation events yet (expected if no calls made)"
fi

# ==========================================
# TEST 11: Frontend Integration
# ==========================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 11: Frontend Integration"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if frontend is running
if docker ps | grep -q "ai-dialer-frontend"; then
    pass "Frontend container running"
else
    warn "Frontend container not found"
fi

# Check nginx
if docker ps | grep -q "nginx"; then
    pass "Nginx reverse proxy running"
else
    warn "Nginx not found"
fi

# ==========================================
# TEST 12: API Health
# ==========================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 12: API Health"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

HEALTH_CHECK=$(docker exec ai-dialer-backend curl -s http://localhost:3000/health 2>/dev/null)
if echo "$HEALTH_CHECK" | grep -q "healthy\|ok"; then
    pass "Backend health check passing"
else
    warn "Backend health check unclear"
fi

# ==========================================
# SUMMARY
# ==========================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "VERIFICATION SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${GREEN}Passed:${NC}   $PASSED tests"
echo -e "${YELLOW}Warnings:${NC} $WARNINGS issues"
echo -e "${RED}Failed:${NC}   $FAILED tests"
echo ""

if [ "$FAILED" -eq 0 ]; then
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}✅ SYSTEM READY FOR AUTOMATED AI CALLS!${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Run: bash start-test-calls.sh"
    echo "2. Open LiveMonitor: https://atsservice.site/"
    echo "3. Monitor: docker-compose -f docker-compose.demo.yml logs -f backend"
elif [ "$FAILED" -le 2 ]; then
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}⚠️  MINOR ISSUES - System may still work${NC}"
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo "Review failed tests above and proceed with caution"
else
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${RED}❌ CRITICAL ISSUES - Fix before testing${NC}"
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo "Fix the failed tests above before proceeding"
fi

echo ""
