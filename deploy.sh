#!/bin/bash

##############################################
# AI Dialer Pro - Production Deployment Script
# Quick deployment helper
##############################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
APP_DIR="/opt/ai-dialer"
ENV_FILE=".env.production"
COMPOSE_FILE="docker-compose.production.yml"

echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN} AI Dialer Pro - Production Deployment${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Function: Check prerequisites
check_prerequisites() {
    echo -e "\n${YELLOW}[1/10] Checking prerequisites...${NC}"

    # Check Docker
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}✗ Docker is not installed${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ Docker found: $(docker --version)${NC}"

    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        echo -e "${RED}✗ Docker Compose is not installed${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ Docker Compose found: $(docker-compose --version)${NC}"

    # Check if running as root or with sudo
    if [ "$EUID" -ne 0 ]; then
        echo -e "${YELLOW}⚠ Warning: Not running as root. You may need sudo for some operations.${NC}"
    fi
}

# Function: Create directories
create_directories() {
    echo -e "\n${YELLOW}[2/10] Creating directories...${NC}"

    mkdir -p backups
    mkdir -p nginx
    mkdir -p certbot/conf
    mkdir -p certbot/www
    mkdir -p server/logs
    mkdir -p server/uploads
    mkdir -p asterisk-logs
    mkdir -p audio-cache

    echo -e "${GREEN}✓ Directories created${NC}"
}

# Function: Check environment file
check_env_file() {
    echo -e "\n${YELLOW}[3/10] Checking environment configuration...${NC}"

    if [ ! -f "$ENV_FILE" ]; then
        echo -e "${RED}✗ Environment file not found: $ENV_FILE${NC}"
        echo -e "${YELLOW}Creating template...${NC}"

        cat > $ENV_FILE << 'EOF'
# IMPORTANT: Change all values before deploying!
NODE_ENV=production
DOMAIN=yourdomain.com
API_URL=https://api.yourdomain.com
CLIENT_URL=https://yourdomain.com

# Database - CHANGE THESE!
POSTGRES_DB=ai_dialer_prod
POSTGRES_USER=ai_dialer_user
POSTGRES_PASSWORD=CHANGE_ME_STRONG_PASSWORD

# Redis - CHANGE THIS!
REDIS_PASSWORD=CHANGE_ME_REDIS_PASSWORD

# JWT & Security - CHANGE THESE!
JWT_SECRET=CHANGE_ME_TO_VERY_LONG_RANDOM_STRING
SESSION_SECRET=CHANGE_ME_SESSION_SECRET

# Telnyx Configuration - ADD YOUR CREDENTIALS!
TELNYX_API_KEY=
TELNYX_SIP_USERNAME=
TELNYX_SIP_PASSWORD=
TELNYX_DID=+1234567890

# Asterisk ARI - CHANGE THIS!
ARI_PASSWORD=CHANGE_ME_ARI_PASSWORD
EOF

        echo -e "${YELLOW}⚠ Please edit $ENV_FILE and configure all variables!${NC}"
        exit 1
    fi

    # Check for unconfigured values
    if grep -q "CHANGE_ME\|yourdomain.com" $ENV_FILE; then
        echo -e "${RED}✗ Environment file contains default values!${NC}"
        echo -e "${YELLOW}Please update the following in $ENV_FILE:${NC}"
        grep -n "CHANGE_ME\|yourdomain.com" $ENV_FILE
        exit 1
    fi

    echo -e "${GREEN}✓ Environment file configured${NC}"
}

# Function: Generate secrets
generate_secrets() {
    echo -e "\n${YELLOW}[4/10] Generating secure secrets (if needed)...${NC}"

    echo "JWT Secret:     $(openssl rand -base64 64 | tr -d '\n')"
    echo "Session Secret: $(openssl rand -base64 32 | tr -d '\n')"
    echo "Redis Password: $(openssl rand -base64 32 | tr -d '\n')"
    echo "DB Password:    $(openssl rand -base64 32 | tr -d '=+/' | cut -c1-25)"

    echo -e "${GREEN}✓ Secrets generated (copy to .env.production if needed)${NC}"
}

# Function: Setup SSL
setup_ssl() {
    echo -e "\n${YELLOW}[5/10] SSL Certificate Setup${NC}"

    read -p "Do you want to setup SSL with Let's Encrypt? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        read -p "Enter your domain: " DOMAIN
        read -p "Enter your email: " EMAIL

        echo -e "${YELLOW}Requesting SSL certificate...${NC}"

        docker-compose -f $COMPOSE_FILE run --rm certbot certonly \
            --webroot \
            --webroot-path=/var/www/certbot \
            --email $EMAIL \
            --agree-tos \
            --no-eff-email \
            -d $DOMAIN

        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✓ SSL certificate obtained${NC}"
        else
            echo -e "${RED}✗ SSL certificate request failed${NC}"
        fi
    else
        echo -e "${YELLOW}⚠ Skipping SSL setup${NC}"
    fi
}

# Function: Build images
build_images() {
    echo -e "\n${YELLOW}[6/10] Building Docker images...${NC}"

    docker-compose -f $COMPOSE_FILE build --no-cache

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Docker images built successfully${NC}"
    else
        echo -e "${RED}✗ Failed to build Docker images${NC}"
        exit 1
    fi
}

# Function: Start services
start_services() {
    echo -e "\n${YELLOW}[7/10] Starting services...${NC}"

    docker-compose -f $COMPOSE_FILE up -d

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Services started${NC}"
    else
        echo -e "${RED}✗ Failed to start services${NC}"
        exit 1
    fi

    echo -e "\n${YELLOW}Waiting for services to be ready...${NC}"
    sleep 10
}

# Function: Run migrations
run_migrations() {
    echo -e "\n${YELLOW}[8/10] Running database migrations...${NC}"

    # Wait for backend to be ready
    for i in {1..30}; do
        if docker exec ai-dialer-backend npm run migrate 2>/dev/null; then
            echo -e "${GREEN}✓ Migrations completed${NC}"
            return 0
        fi
        echo -n "."
        sleep 2
    done

    echo -e "${RED}✗ Migration timeout${NC}"
    echo -e "${YELLOW}You may need to run migrations manually:${NC}"
    echo "  docker exec -it ai-dialer-backend npm run migrate"
}

# Function: Create admin user
create_admin() {
    echo -e "\n${YELLOW}[9/10] Creating admin user...${NC}"

    read -p "Create admin user now? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker exec -it ai-dialer-backend node scripts/create-admin.js
    else
        echo -e "${YELLOW}⚠ Skipping admin user creation${NC}"
        echo "You can create admin later with:"
        echo "  docker exec -it ai-dialer-backend node scripts/create-admin.js"
    fi
}

# Function: Health check
health_check() {
    echo -e "\n${YELLOW}[10/10] Running health checks...${NC}"

    # Check containers
    echo -e "\nContainer Status:"
    docker-compose -f $COMPOSE_FILE ps

    # Check backend health
    echo -e "\n${YELLOW}Checking backend API...${NC}"
    if curl -f http://localhost:3000/health &> /dev/null; then
        echo -e "${GREEN}✓ Backend API is healthy${NC}"
    else
        echo -e "${RED}✗ Backend API is not responding${NC}"
    fi

    # Check database
    echo -e "\n${YELLOW}Checking database...${NC}"
    if docker exec ai-dialer-postgres pg_isready -U ai_dialer_user &> /dev/null; then
        echo -e "${GREEN}✓ Database is ready${NC}"
    else
        echo -e "${RED}✗ Database is not ready${NC}"
    fi

    # Check Redis
    echo -e "\n${YELLOW}Checking Redis...${NC}"
    if docker exec ai-dialer-redis redis-cli ping &> /dev/null; then
        echo -e "${GREEN}✓ Redis is ready${NC}"
    else
        echo -e "${RED}✗ Redis is not ready${NC}"
    fi
}

# Function: Show summary
show_summary() {
    echo -e "\n${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN} Deployment Complete!${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

    # Load domain from env file
    DOMAIN=$(grep "^DOMAIN=" $ENV_FILE | cut -d'=' -f2)

    echo -e "\n${YELLOW}Access your application:${NC}"
    echo "  Frontend: https://$DOMAIN"
    echo "  API:      https://api.$DOMAIN"
    echo "  Health:   http://localhost:3000/health"

    echo -e "\n${YELLOW}Useful commands:${NC}"
    echo "  View logs:        docker-compose -f $COMPOSE_FILE logs -f"
    echo "  Restart services: docker-compose -f $COMPOSE_FILE restart"
    echo "  Stop services:    docker-compose -f $COMPOSE_FILE down"
    echo "  Backup database:  ./scripts/backup-db.sh"

    echo -e "\n${YELLOW}Next steps:${NC}"
    echo "  1. Configure DNS records to point to this server"
    echo "  2. Test the application thoroughly"
    echo "  3. Setup automated backups (cron)"
    echo "  4. Configure monitoring and alerts"
    echo "  5. Review security settings"

    echo -e "\n${GREEN}For detailed documentation, see: PRODUCTION_DEPLOYMENT_GUIDE.md${NC}"
}

# Main execution
main() {
    check_prerequisites
    create_directories
    check_env_file
    generate_secrets
    setup_ssl
    build_images
    start_services
    run_migrations
    create_admin
    health_check
    show_summary
}

# Run main function
main
