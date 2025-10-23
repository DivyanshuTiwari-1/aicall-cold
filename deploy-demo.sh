#!/bin/bash

##############################################
# AI Dialer Pro - Demo Deployment (IP Only)
# No domain required!
##############################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

clear
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}   AI Dialer Pro - Demo Deployment${NC}"
echo -e "${BLUE}   IP Address Only (No Domain Needed)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Get server IP
echo -e "${YELLOW}Step 1: Getting your server IP address...${NC}"
SERVER_IP=$(curl -s ifconfig.me)
if [ -z "$SERVER_IP" ]; then
    echo -e "${RED}✗ Could not detect server IP automatically${NC}"
    read -p "Enter your server IP address: " SERVER_IP
fi
echo -e "${GREEN}✓ Server IP: $SERVER_IP${NC}"
echo ""

# Check prerequisites
echo -e "${YELLOW}Step 2: Checking prerequisites...${NC}"
if ! command -v docker &> /dev/null; then
    echo -e "${RED}✗ Docker not found. Installing...${NC}"
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
fi
echo -e "${GREEN}✓ Docker: $(docker --version)${NC}"

if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}✗ Docker Compose not found. Installing...${NC}"
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
fi
echo -e "${GREEN}✓ Docker Compose: $(docker-compose --version)${NC}"
echo ""

# Create directories
echo -e "${YELLOW}Step 3: Creating directories...${NC}"
mkdir -p backups server/logs server/uploads asterisk-logs audio-cache
echo -e "${GREEN}✓ Directories created${NC}"
echo ""

# Generate secrets
echo -e "${YELLOW}Step 4: Generating secure secrets...${NC}"
JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')
DB_PASSWORD=$(openssl rand -base64 32 | tr -d '\n' | tr -d '=+/' | cut -c1-25)
REDIS_PASSWORD=$(openssl rand -base64 32 | tr -d '\n' | tr -d '=+/' | cut -c1-25)
SESSION_SECRET=$(openssl rand -base64 32 | tr -d '\n')
ARI_PASSWORD=$(openssl rand -base64 16 | tr -d '\n' | tr -d '=+/' | cut -c1-16)
echo -e "${GREEN}✓ Secrets generated${NC}"
echo ""

# Get Telnyx credentials
echo -e "${YELLOW}Step 5: Telnyx Configuration${NC}"
echo -e "To make calls, you need Telnyx credentials."
echo -e "Get them from: ${BLUE}https://portal.telnyx.com/${NC}"
echo ""
read -p "Enter Telnyx API Key (or press Enter to skip): " TELNYX_API_KEY
read -p "Enter Telnyx SIP Username (or press Enter to skip): " TELNYX_SIP_USERNAME
read -p "Enter Telnyx SIP Password (or press Enter to skip): " TELNYX_SIP_PASSWORD
read -p "Enter Telnyx Phone Number (or press Enter to skip): " TELNYX_DID

if [ -z "$TELNYX_API_KEY" ]; then
    echo -e "${YELLOW}⚠ Warning: No Telnyx credentials. You won't be able to make calls.${NC}"
    TELNYX_API_KEY="your_api_key_here"
    TELNYX_SIP_USERNAME="your_username_here"
    TELNYX_SIP_PASSWORD="your_password_here"
    TELNYX_DID="+1234567890"
fi
echo ""

# Create .env.production
echo -e "${YELLOW}Step 6: Creating environment configuration...${NC}"
cat > .env.production << EOF
# AI Dialer Demo Configuration
NODE_ENV=production

# Server Configuration
SERVER_IP=$SERVER_IP
DOMAIN=$SERVER_IP
API_URL=http://$SERVER_IP:3000
CLIENT_URL=http://$SERVER_IP:3001

# Database
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=ai_dialer_prod
POSTGRES_USER=ai_dialer_user
POSTGRES_PASSWORD=$DB_PASSWORD

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=$REDIS_PASSWORD

# Security
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=7d
SESSION_SECRET=$SESSION_SECRET

# Telnyx
TELNYX_API_KEY=$TELNYX_API_KEY
TELNYX_SIP_USERNAME=$TELNYX_SIP_USERNAME
TELNYX_SIP_PASSWORD=$TELNYX_SIP_PASSWORD
TELNYX_DOMAIN=sip.telnyx.com
TELNYX_DID=$TELNYX_DID
TELNYX_PHONE_NUMBER=$TELNYX_DID
TELNYX_CALLER_ID=$TELNYX_DID

# Asterisk ARI
ARI_URL=http://asterisk:8088/ari
ARI_USERNAME=ai-dialer
ARI_PASSWORD=$ARI_PASSWORD

# Application
PORT=3000
FRONTEND_PORT=3001
LOG_LEVEL=info
MAX_CONCURRENT_CALLS=10
CALL_INTERVAL_MS=30000
MAX_RETRY_ATTEMPTS=3
MAX_FILE_SIZE=10485760
UPLOAD_DIR=/app/uploads
EOF

echo -e "${GREEN}✓ Configuration created${NC}"
echo ""

# Configure firewall
echo -e "${YELLOW}Step 7: Configuring firewall...${NC}"
if command -v ufw &> /dev/null; then
    sudo ufw allow 22/tcp
    sudo ufw allow 3000/tcp
    sudo ufw allow 3001/tcp
    sudo ufw allow 5060/udp
    sudo ufw allow 8088/tcp
    sudo ufw allow 10000:10100/udp
    sudo ufw --force enable
    echo -e "${GREEN}✓ Firewall configured${NC}"
else
    echo -e "${YELLOW}⚠ UFW not found, skipping firewall configuration${NC}"
fi
echo ""

# Build and start
echo -e "${YELLOW}Step 8: Building and starting services...${NC}"
echo -e "${BLUE}This may take 5-10 minutes on first run...${NC}"
docker-compose -f docker-compose.demo.yml up -d --build

if [ $? -ne 0 ]; then
    echo -e "${RED}✗ Failed to start services${NC}"
    echo -e "${YELLOW}Check logs with: docker-compose -f docker-compose.demo.yml logs${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Services started${NC}"
echo ""

# Wait for backend
echo -e "${YELLOW}Step 9: Waiting for backend to be ready...${NC}"
for i in {1..30}; do
    if curl -f http://localhost:3000/health &> /dev/null; then
        echo -e "${GREEN}✓ Backend is ready${NC}"
        break
    fi
    echo -n "."
    sleep 2
done
echo ""

# Run migrations
echo -e "${YELLOW}Step 10: Running database migrations...${NC}"
docker exec ai-dialer-backend npm run migrate
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Migrations completed${NC}"
else
    echo -e "${RED}✗ Migrations failed${NC}"
fi
echo ""

# Create admin user
echo -e "${YELLOW}Step 11: Creating admin user...${NC}"
echo -e "Default credentials will be created:"
echo -e "  Email: admin@demo.com"
echo -e "  Password: Admin123!"
echo ""

# Create admin user automatically
docker exec ai-dialer-backend node -e "
const { query } = require('./config/database');
const bcrypt = require('bcryptjs');

async function createAdmin() {
    const hashedPassword = await bcrypt.hash('Admin123!', 10);
    await query(\`
        INSERT INTO users (email, password, first_name, last_name, role, organization_id)
        VALUES (\$1, \$2, \$3, \$4, \$5, (SELECT id FROM organizations LIMIT 1))
        ON CONFLICT (email) DO NOTHING
    \`, ['admin@demo.com', hashedPassword, 'Admin', 'User', 'admin']);
    console.log('Admin user created successfully');
}

createAdmin().catch(console.error);
" 2>/dev/null

echo -e "${GREEN}✓ Admin user created${NC}"
echo ""

# Health check
echo -e "${YELLOW}Step 12: Running health checks...${NC}"
docker-compose -f docker-compose.demo.yml ps
echo ""

# Final summary
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  🎉 Deployment Complete!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BLUE}Access your AI Dialer Demo:${NC}"
echo -e "  Frontend: ${GREEN}http://$SERVER_IP:3001${NC}"
echo -e "  API:      ${GREEN}http://$SERVER_IP:3000${NC}"
echo ""
echo -e "${BLUE}Login Credentials:${NC}"
echo -e "  Email:    ${GREEN}admin@demo.com${NC}"
echo -e "  Password: ${GREEN}Admin123!${NC}"
echo ""
echo -e "${BLUE}Useful Commands:${NC}"
echo -e "  View logs:     docker-compose -f docker-compose.demo.yml logs -f"
echo -e "  Restart:       docker-compose -f docker-compose.demo.yml restart"
echo -e "  Stop:          docker-compose -f docker-compose.demo.yml down"
echo -e "  Status:        docker-compose -f docker-compose.demo.yml ps"
echo ""
if [ "$TELNYX_API_KEY" == "your_api_key_here" ]; then
    echo -e "${YELLOW}⚠ Note: Add Telnyx credentials to .env.production to enable calling${NC}"
    echo ""
fi
echo -e "${GREEN}Happy testing! 🚀${NC}"
echo ""
