#!/bin/bash

#################################################################################
# Simplified Automated Calls - Production Deployment Script
# This script deploys the new Telnyx Call Control API implementation
#################################################################################

set -e  # Exit on error

echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║  Deploying Simplified Automated Calls System                    ║"
echo "║  Telnyx Call Control API - No AGI Server Needed                 ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if TELNYX_API_KEY is set
if [ -z "$TELNYX_API_KEY" ]; then
    echo -e "${YELLOW}⚠️  TELNYX_API_KEY not set in environment${NC}"
    echo "Please set it before starting containers:"
    echo "  export TELNYX_API_KEY='your_api_key_here'"
    echo ""
    echo "Get your API key from: https://portal.telnyx.com/#/app/api-keys"
    echo ""
    read -p "Press Enter to continue anyway (will use from .env if available)..."
fi

echo -e "${BLUE}1️⃣  Pulling latest code from Git...${NC}"
git pull origin main
echo -e "${GREEN}✅ Code updated${NC}"
echo ""

echo -e "${BLUE}2️⃣  Stopping current containers...${NC}"
docker-compose down
echo -e "${GREEN}✅ Containers stopped${NC}"
echo ""

echo -e "${BLUE}3️⃣  Rebuilding containers with new code...${NC}"
docker-compose build
echo -e "${GREEN}✅ Containers rebuilt${NC}"
echo ""

echo -e "${BLUE}4️⃣  Starting services...${NC}"
docker-compose up -d
echo -e "${GREEN}✅ Services started${NC}"
echo ""

echo -e "${BLUE}5️⃣  Waiting for services to be ready...${NC}"
sleep 10

echo -e "${BLUE}6️⃣  Checking service status...${NC}"
docker-compose ps
echo ""

echo -e "${BLUE}7️⃣  Checking backend logs...${NC}"
docker-compose logs --tail=50 ai_dialer | grep -E "Automated calls|Stasis|FastAGI" || true
echo ""

echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║  Deployment Complete!                                            ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""
echo -e "${GREEN}✅ System deployed successfully${NC}"
echo ""
echo "Expected log messages:"
echo "  ✅ Automated calls configured via Telnyx Call Control API (webhook-based)"
echo "  ✅ Manual Bridge Stasis App registered (for browser phone)"
echo "  ✅ Stasis application started (manual calls only)"
echo "  ℹ️  Note: Automated AI calls now use Telnyx webhooks instead of Stasis"
echo ""
echo "Next steps:"
echo "  1. Configure Telnyx webhook URL in portal.telnyx.com"
echo "  2. Run test script: ./test-simplified-calls.sh"
echo "  3. Monitor logs: docker-compose logs -f ai_dialer"
echo ""

