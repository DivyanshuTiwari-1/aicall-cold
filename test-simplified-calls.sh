#!/bin/bash

#################################################################################
# Test Script for Simplified Automated Calls
# This script creates 5 test calls to verify the new Telnyx implementation
#################################################################################

set -e

echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║  Testing Simplified Automated Calls System                      ║"
echo "║  Telnyx Call Control API Integration                            ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
API_URL="${API_URL:-http://localhost:3000/api/v1}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@example.com}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin123}"

# Test phone numbers - REPLACE WITH YOUR REAL NUMBERS
TEST_PHONES=(
    "+1234567890"
    "+1234567891"
    "+1234567892"
    "+1234567893"
    "+1234567894"
)

echo -e "${YELLOW}⚠️  WARNING: This will make 5 REAL phone calls!${NC}"
echo ""
echo "Test phone numbers configured:"
for i in "${!TEST_PHONES[@]}"; do
    echo "  $((i+1)). ${TEST_PHONES[$i]}"
done
echo ""
echo -e "${RED}IMPORTANT: Update TEST_PHONES array in this script with your real phone numbers!${NC}"
echo ""
read -p "Press Enter to continue or Ctrl+C to cancel..."
echo ""

# Function to make API call
api_call() {
    local method=$1
    local endpoint=$2
    local data=$3
    local token=$4
    
    if [ -n "$token" ]; then
        curl -s -X "$method" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer $token" \
            -d "$data" \
            "$API_URL$endpoint"
    else
        curl -s -X "$method" \
            -H "Content-Type: application/json" \
            -d "$data" \
            "$API_URL$endpoint"
    fi
}

echo -e "${BLUE}1️⃣  Logging in...${NC}"
LOGIN_RESPONSE=$(api_call "POST" "/auth/login" "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")

TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
ORG_ID=$(echo "$LOGIN_RESPONSE" | grep -o '"organizationId":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
    echo -e "${RED}❌ Login failed! Check credentials.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Logged in successfully${NC}"
echo "   Organization ID: $ORG_ID"
echo ""

echo -e "${BLUE}2️⃣  Creating test campaign...${NC}"
CAMPAIGN_NAME="Test Simplified Calls $(date +%s)"
CAMPAIGN_RESPONSE=$(api_call "POST" "/campaigns" "{\"name\":\"$CAMPAIGN_NAME\",\"type\":\"sales\",\"status\":\"active\",\"description\":\"Testing new Telnyx Call Control API implementation\"}" "$TOKEN")

CAMPAIGN_ID=$(echo "$CAMPAIGN_RESPONSE" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)

if [ -z "$CAMPAIGN_ID" ]; then
    echo -e "${RED}❌ Campaign creation failed!${NC}"
    echo "$CAMPAIGN_RESPONSE"
    exit 1
fi

echo -e "${GREEN}✅ Campaign created${NC}"
echo "   Campaign ID: $CAMPAIGN_ID"
echo ""

echo -e "${BLUE}3️⃣  Adding 5 test contacts...${NC}"
for i in "${!TEST_PHONES[@]}"; do
    CONTACT_RESPONSE=$(api_call "POST" "/contacts" "{\"firstName\":\"TestContact$((i+1))\",\"lastName\":\"AutomatedTest\",\"phone\":\"${TEST_PHONES[$i]}\",\"email\":\"test$((i+1))@example.com\",\"campaignId\":\"$CAMPAIGN_ID\",\"status\":\"pending\"}" "$TOKEN")
    echo -e "   ${GREEN}✓${NC} Contact $((i+1)) added: ${TEST_PHONES[$i]}"
done
echo -e "${GREEN}✅ All contacts added${NC}"
echo ""

echo -e "${BLUE}4️⃣  Getting phone number...${NC}"
PHONE_RESPONSE=$(api_call "GET" "/phone-numbers" "" "$TOKEN")
PHONE_NUMBER_ID=$(echo "$PHONE_RESPONSE" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
PHONE_NUMBER=$(echo "$PHONE_RESPONSE" | grep -o '"phoneNumber":"[^"]*' | head -1 | cut -d'"' -f4)

if [ -z "$PHONE_NUMBER_ID" ]; then
    echo -e "${RED}❌ No phone number found! Please configure one first.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Using phone number${NC}"
echo "   Phone ID: $PHONE_NUMBER_ID"
echo "   Number: $PHONE_NUMBER"
echo ""

echo -e "${BLUE}5️⃣  Starting automated call queue...${NC}"
QUEUE_RESPONSE=$(api_call "POST" "/calls/automated/start" "{\"campaignId\":\"$CAMPAIGN_ID\",\"phoneNumberId\":\"$PHONE_NUMBER_ID\"}" "$TOKEN")

if echo "$QUEUE_RESPONSE" | grep -q "success.*true"; then
    echo -e "${GREEN}✅ Queue started successfully!${NC}"
else
    echo -e "${RED}❌ Queue start failed!${NC}"
    echo "$QUEUE_RESPONSE"
    exit 1
fi
echo ""

echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║  Test Calls Started!                                             ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""
echo -e "${GREEN}📞 Automated calls are now being made to your test numbers${NC}"
echo ""
echo "What's happening:"
echo "  1. Queue processes contacts every 5 seconds"
echo "  2. Telnyx dials each number"
echo "  3. When answered, AI conversation begins"
echo "  4. Conversation streamed via WebSocket to Live Monitor"
echo "  5. After call ends, transcript saved to database"
echo ""
echo "Monitor progress:"
echo "  • Watch logs: docker-compose logs -f ai_dialer | grep -E 'Telnyx|Call|Recording'"
echo "  • Check UI: https://yourdomain.com/live-monitor"
echo "  • Database: docker-compose exec postgres psql -U postgres -d ai_dialer -c \"SELECT id, status, outcome, duration FROM calls WHERE campaign_id = '$CAMPAIGN_ID' ORDER BY created_at DESC;\""
echo ""
echo "Expected timeline:"
echo "  • Call 1: Now"
echo "  • Call 2: +5 seconds"
echo "  • Call 3: +10 seconds"
echo "  • Call 4: +15 seconds"
echo "  • Call 5: +20 seconds"
echo ""
echo "Cost estimate:"
echo "  • ~$0.055 per 5-minute call"
echo "  • Total for 5 calls: ~$0.275"
echo ""

echo -e "${YELLOW}Waiting 60 seconds for calls to complete...${NC}"
for i in {60..1}; do
    echo -ne "  Time remaining: ${i}s \r"
    sleep 1
done
echo ""
echo ""

echo -e "${BLUE}6️⃣  Checking call results...${NC}"
echo ""
docker-compose exec -T postgres psql -U postgres -d ai_dialer << EOF
SELECT 
    id,
    status,
    outcome,
    duration,
    cost,
    to_char(created_at, 'HH24:MI:SS') as time
FROM calls 
WHERE campaign_id = '$CAMPAIGN_ID'
ORDER BY created_at DESC;
EOF

echo ""
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║  Test Complete!                                                  ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""
echo "Check results:"
echo "  1. Review call statuses above"
echo "  2. Check Live Monitor UI for conversation details"
echo "  3. View Call History for transcripts"
echo "  4. Verify webhooks were received: docker-compose logs ai_dialer | grep 'webhook received'"
echo ""
echo "Cleanup (optional):"
echo "  • Stop queue: curl -X POST -H \"Authorization: Bearer $TOKEN\" $API_URL/calls/automated/stop -d \"{\\\"campaignId\\\":\\\"$CAMPAIGN_ID\\\"}\""
echo "  • Delete campaign: curl -X DELETE -H \"Authorization: Bearer $TOKEN\" $API_URL/campaigns/$CAMPAIGN_ID"
echo ""

