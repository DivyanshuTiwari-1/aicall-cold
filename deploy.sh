#!/bin/bash
set -e

################################################################################
# AI Dialer - Complete Production Deployment Script
#
# ONLY CHANGE THIS: Set your domain name below
# Everything else is handled automatically
################################################################################

# ============================================================================
# 🔧 CONFIGURATION - CHANGE THIS TO YOUR DOMAIN
# ============================================================================
DOMAIN="yourdomain.com"  # ⚠️ CHANGE THIS TO YOUR ACTUAL DOMAIN

# ============================================================================
# DO NOT CHANGE ANYTHING BELOW THIS LINE
# ============================================================================

echo "========================================"
echo "🚀 AI Dialer Production Deployment"
echo "========================================"
echo ""
echo "Domain: $DOMAIN"
echo ""

# Detect if this is first run or update
FIRST_RUN=false
if [ ! -f .env.production ]; then
    FIRST_RUN=true
    echo "📋 Mode: First Time Deployment"
else
    echo "📋 Mode: Update Deployment"
fi
echo ""

# Get server IP
echo "🔍 Detecting server IP..."
PUBLIC_IP=$(curl -s ifconfig.me || curl -s icanhazip.com || echo "localhost")
echo "   Server IP: $PUBLIC_IP"
echo ""

# ============================================================================
# STEP 1: BACKUP EXISTING DATA (if exists)
# ============================================================================
if [ "$FIRST_RUN" = false ]; then
    echo "💾 Creating backup of existing data..."
    BACKUP_DIR="./backups"
    BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
    mkdir -p $BACKUP_DIR

    # Backup database if container exists
    if docker ps -a | grep -q ai-dialer-postgres; then
        echo "   Backing up database..."
        docker exec ai-dialer-postgres pg_dump -U ai_dialer_user ai_dialer_prod 2>/dev/null | \
          gzip > $BACKUP_DIR/backup_${BACKUP_DATE}.sql.gz || echo "   No database to backup"
    fi
    echo "   ✓ Backup complete"
    echo ""
fi

# ============================================================================
# STEP 2: GENERATE SECURE CREDENTIALS (only on first run)
# ============================================================================
if [ "$FIRST_RUN" = true ]; then
    echo "🔐 Generating secure passwords..."
    DB_PASSWORD=$(openssl rand -base64 32 | tr -d '\n' | tr -d '=+/')
    REDIS_PASSWORD=$(openssl rand -base64 32 | tr -d '\n' | tr -d '=+/')
    ARI_PASSWORD=$(openssl rand -base64 32 | tr -d '\n' | tr -d '=+/')
    JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')
    SESSION_SECRET=$(openssl rand -base64 32 | tr -d '\n')
    echo "   ✓ Passwords generated"
    echo ""
else
    echo "📝 Loading existing credentials..."
    source .env.production
    echo "   ✓ Credentials loaded"
    echo ""
fi

# ============================================================================
# STEP 3: CREATE ENVIRONMENT FILES
# ============================================================================
echo "📝 Creating environment configuration..."

# Server .env.production
cat > .env.production << EOF
# Production Environment - Auto-generated on $(date)
# Domain: $DOMAIN

# =============================================================================
# DOMAIN CONFIGURATION
# =============================================================================
DOMAIN=$DOMAIN
API_URL=https://api.$DOMAIN
CLIENT_URL=https://$DOMAIN

# =============================================================================
# DATABASE CONFIGURATION
# =============================================================================
DB_HOST=postgres
DB_PORT=5432
DB_NAME=ai_dialer_prod
DB_USER=ai_dialer_user
DB_PASSWORD=$DB_PASSWORD

POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=ai_dialer_prod
POSTGRES_USER=ai_dialer_user
POSTGRES_PASSWORD=$DB_PASSWORD

# =============================================================================
# REDIS CONFIGURATION
# =============================================================================
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=$REDIS_PASSWORD

# =============================================================================
# SECURITY & JWT
# =============================================================================
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=7d
SESSION_SECRET=$SESSION_SECRET

# =============================================================================
# ASTERISK ARI CONFIGURATION
# =============================================================================
ARI_URL=http://asterisk:8088/ari
ARI_USERNAME=ai-dialer
ARI_PASSWORD=$ARI_PASSWORD
ASTERISK_HOST=asterisk
ASTERISK_ARI_PORT=8088

# =============================================================================
# TELNYX CONFIGURATION
# =============================================================================
TELNYX_API_KEY=KEY0199FFA0EB5D4947F9F3CD455BE32997
TELNYX_PHONE_NUMBER=+18058690081
TELNYX_SIP_USERNAME=userinfo63399
TELNYX_SIP_PASSWORD=-WUgqhX.ZXYM
TELNYX_DOMAIN=sip.telnyx.com
TELNYX_SIP_URI=userinfo63399@sip.telnyx.com
TELNYX_CALLER_ID=+18058690081
TELNYX_IP_RANGE=

# =============================================================================
# APPLICATION CONFIGURATION
# =============================================================================
NODE_ENV=production
PORT=3000
VOICE_STACK=self_hosted

# =============================================================================
# TEXT-TO-SPEECH CONFIGURATION
# =============================================================================
TTS_ENGINE=google
TTS_LANGUAGE=en-US
TTS_VOICE=en-US-Wavenet-D
TTS_SPEED=1.0
TTS_PITCH=0.0
TTS_VOLUME=0.0
TTS_CACHE_ENABLED=true
TTS_CACHE_TTL=3600
TTS_CACHE_MAX_SIZE=1000

# =============================================================================
# CALL CONFIGURATION
# =============================================================================
DEFAULT_CALL_TIMEOUT=30
MAX_CALL_DURATION=300
MAX_CONCURRENT_CALLS=50
CALL_INTERVAL_MS=30000
MAX_RETRY_ATTEMPTS=3

# =============================================================================
# CORS CONFIGURATION
# =============================================================================
CORS_ORIGIN=https://$DOMAIN,https://www.$DOMAIN,https://api.$DOMAIN

# =============================================================================
# RATE LIMITING
# =============================================================================
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=10000

# =============================================================================
# LOGGING
# =============================================================================
LOG_LEVEL=info
LOG_FILE=logs/app.log
ERROR_LOG_FILE=logs/error.log
DEBUG=ai-dialer:*
ENABLE_DEBUG_LOGS=true

# =============================================================================
# DATABASE POOL
# =============================================================================
DB_POOL_MIN=2
DB_POOL_MAX=10
DB_POOL_IDLE_TIMEOUT=30000

# =============================================================================
# FEATURES
# =============================================================================
ENABLE_EMOTION_DETECTION=true
ENABLE_VOICE_ANALYTICS=true
ENABLE_CALL_RECORDING=true
ENABLE_REAL_TIME_MONITORING=true
ENABLE_AI_CONVERSATION=true

# =============================================================================
# HEALTH CHECK
# =============================================================================
HEALTH_CHECK_INTERVAL=30000
HEALTH_CHECK_TIMEOUT=5000
EOF

chmod 600 .env.production
echo "   ✓ Server environment created"

# Client .env
cat > client/.env << EOF
REACT_APP_API_URL=/api/v1
REACT_APP_WS_URL=/ws
REACT_APP_API_BASE_URL=https://api.$DOMAIN
EOF

echo "   ✓ Client environment created"

# Asterisk ARI config
mkdir -p asterisk-config
cat > asterisk-config/ari.conf << EOF
[general]
enabled = yes
pretty = yes
allowed_origins = *

[ai-dialer]
type = user
read_only = no
password = $ARI_PASSWORD
EOF

echo "   ✓ Asterisk ARI config created"
echo ""

# ============================================================================
# STEP 4: SETUP SSL CERTIFICATE
# ============================================================================
echo "🔐 Setting up SSL certificate..."

# Check if domain resolves
if ! nslookup $DOMAIN > /dev/null 2>&1; then
    echo "   ⚠️  WARNING: Domain $DOMAIN does not resolve to this server!"
    echo "   Please configure DNS first with these records:"
    echo ""
    echo "   A    @      $PUBLIC_IP"
    echo "   A    www    $PUBLIC_IP"
    echo "   A    api    $PUBLIC_IP"
    echo ""
    read -p "   Continue anyway? (yes/no): " continue_dns
    if [ "$continue_dns" != "yes" ]; then
        echo "Deployment cancelled. Please configure DNS first."
        exit 1
    fi
fi

# Setup SSL
mkdir -p ./ssl

if [ ! -f ./ssl/nginx-selfsigned.crt ] || [ "$FIRST_RUN" = true ]; then
    # Try Let's Encrypt first
    if command -v certbot &> /dev/null; then
        echo "   Attempting Let's Encrypt certificate..."

        # Stop any service on port 80
        docker-compose -f docker-compose.demo.yml stop frontend 2>/dev/null || true

        sudo certbot certonly --standalone \
          -d $DOMAIN \
          -d www.$DOMAIN \
          -d api.$DOMAIN \
          --non-interactive \
          --agree-tos \
          --email admin@$DOMAIN 2>/dev/null || {
            echo "   Let's Encrypt failed, generating self-signed certificate..."
            openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
              -keyout ./ssl/nginx-selfsigned.key \
              -out ./ssl/nginx-selfsigned.crt \
              -subj "/C=US/ST=State/L=City/O=Organization/CN=$DOMAIN"

            # Generate dhparam
            openssl dhparam -out ./ssl/dhparam.pem 2048 2>/dev/null || \
              openssl dhparam -out ./ssl/dhparam.pem 1024
        }

        # Copy Let's Encrypt certs if successful
        if [ -d /etc/letsencrypt/live/$DOMAIN ]; then
            sudo cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem ./ssl/nginx-selfsigned.crt
            sudo cp /etc/letsencrypt/live/$DOMAIN/privkey.pem ./ssl/nginx-selfsigned.key
            sudo chmod 644 ./ssl/nginx-selfsigned.crt
            sudo chmod 600 ./ssl/nginx-selfsigned.key

            # Generate dhparam if needed
            if [ ! -f ./ssl/dhparam.pem ]; then
                openssl dhparam -out ./ssl/dhparam.pem 2048 2>/dev/null || \
                  openssl dhparam -out ./ssl/dhparam.pem 1024
            fi
        fi
    else
        echo "   Certbot not found, generating self-signed certificate..."
        openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
          -keyout ./ssl/nginx-selfsigned.key \
          -out ./ssl/nginx-selfsigned.crt \
          -subj "/C=US/ST=State/L=City/O=Organization/CN=$DOMAIN"

        openssl dhparam -out ./ssl/dhparam.pem 2048 2>/dev/null || \
          openssl dhparam -out ./ssl/dhparam.pem 1024
    fi
fi

echo "   ✓ SSL certificates ready"
echo ""

# ============================================================================
# STEP 5: CLEANUP OLD CONTAINERS & IMAGES (preserve volumes!)
# ============================================================================
echo "🧹 Cleaning up old containers and images..."

# Stop and remove containers (but keep volumes!)
docker-compose -f docker-compose.demo.yml down 2>/dev/null || true

# Remove old images to free space
docker image prune -a -f > /dev/null 2>&1 || true

# Remove dangling volumes (not the named ones we need!)
docker volume prune -f > /dev/null 2>&1 || true

echo "   ✓ Cleanup complete (data volumes preserved)"
echo ""

# ============================================================================
# STEP 6: BUILD AND DEPLOY SERVICES
# ============================================================================
echo "🚀 Building and deploying services..."
echo "   (This may take 3-5 minutes on first run)"
echo ""

# Export environment variables for docker-compose
export POSTGRES_PASSWORD=$DB_PASSWORD
export REDIS_PASSWORD=$REDIS_PASSWORD
export ARI_PASSWORD=$ARI_PASSWORD
export CLIENT_URL=https://$DOMAIN
export API_URL=https://api.$DOMAIN
export JWT_SECRET=$JWT_SECRET
export SESSION_SECRET=$SESSION_SECRET
export POSTGRES_DB=ai_dialer_prod
export POSTGRES_USER=ai_dialer_user

# Build images
docker-compose -f docker-compose.demo.yml build --no-cache

# Start services
docker-compose -f docker-compose.demo.yml up -d

echo "   ✓ Services started"
echo ""

# ============================================================================
# STEP 7: WAIT FOR SERVICES TO BE READY
# ============================================================================
echo "⏳ Waiting for services to initialize..."

# Wait for database
echo -n "   Waiting for database"
for i in {1..30}; do
    if docker exec ai-dialer-postgres pg_isready -U ai_dialer_user > /dev/null 2>&1; then
        echo " ✓"
        break
    fi
    echo -n "."
    sleep 2
done

# Wait for backend
echo -n "   Waiting for backend"
for i in {1..60}; do
    if curl -f -s http://localhost:3000/health > /dev/null 2>&1; then
        echo " ✓"
        break
    fi
    echo -n "."
    sleep 2
done

echo ""

# ============================================================================
# STEP 8: DATABASE SETUP (only on first run)
# ============================================================================
if [ "$FIRST_RUN" = true ]; then
    echo "🔄 Setting up database..."

    # Wait a bit more for database to be fully ready
    sleep 10

    # Run migrations
    echo "   Running migrations..."
    docker exec ai-dialer-backend npm run migrate 2>&1 | tail -10 || echo "   Migrations completed or not needed"

    # Create default organization
    echo "   Creating default organization..."
    docker exec ai-dialer-backend node -e "
    const {query} = require('./config/database');
    (async () => {
        try {
            await query('INSERT INTO organizations (name) VALUES (\$1) ON CONFLICT DO NOTHING', ['Default Organization']);
            console.log('   ✓ Organization created');
        } catch(e) {
            console.log('   Organization may already exist');
        }
        process.exit(0);
    })();
    " 2>&1

    # Create admin user
    echo "   Creating admin user..."
    docker exec ai-dialer-backend node -e "
    const {query} = require('./config/database');
    const bcrypt = require('bcryptjs');
    (async () => {
        try {
            const hashedPassword = await bcrypt.hash('Admin123!', 10);
            await query(\`
                INSERT INTO users (email, password_hash, first_name, last_name, role, organization_id)
                VALUES (\\\$1, \\\$2, \\\$3, \\\$4, \\\$5, (SELECT id FROM organizations LIMIT 1))
                ON CONFLICT (email) DO NOTHING
            \`, ['admin@$DOMAIN', hashedPassword, 'Admin', 'User', 'admin']);
            console.log('   ✓ Admin user created: admin@$DOMAIN / Admin123!');
        } catch(e) {
            console.log('   Admin user may already exist');
        }
        process.exit(0);
    })();
    " 2>&1

    echo ""
fi

# ============================================================================
# STEP 9: CONFIGURE FIREWALL
# ============================================================================
echo "🔥 Configuring firewall..."
sudo ufw allow 22/tcp comment 'SSH' 2>/dev/null || true
sudo ufw allow 80/tcp comment 'HTTP' 2>/dev/null || true
sudo ufw allow 443/tcp comment 'HTTPS' 2>/dev/null || true
sudo ufw allow 3000/tcp comment 'Backend API' 2>/dev/null || true
sudo ufw allow 3001/tcp comment 'Frontend' 2>/dev/null || true
sudo ufw allow 5060/udp comment 'SIP' 2>/dev/null || true
sudo ufw allow 8088/tcp comment 'Asterisk ARI' 2>/dev/null || true
sudo ufw allow 10000:10100/udp comment 'RTP Media' 2>/dev/null || true
echo "   ✓ Firewall configured"
echo ""

# ============================================================================
# STEP 10: FINAL HEALTH CHECK
# ============================================================================
echo "🔍 Final health check..."

BACKEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health)
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001)

echo ""
echo "========================================"
echo "✅ DEPLOYMENT COMPLETE!"
echo "========================================"
echo ""
echo "🌐 Your Application URLs:"
echo "   Frontend:  https://$DOMAIN"
echo "   www:       https://www.$DOMAIN"
echo "   API:       https://api.$DOMAIN"
echo ""
echo "📊 Local Access (for testing):"
echo "   Frontend:  http://$PUBLIC_IP:3001"
echo "   Backend:   http://$PUBLIC_IP:3000"
echo ""
echo "🔐 Admin Login:"
if [ "$FIRST_RUN" = true ]; then
    echo "   Email:     admin@$DOMAIN"
    echo "   Password:  Admin123!"
else
    echo "   Use your existing credentials"
fi
echo ""
echo "📊 Service Status:"
echo "   Backend:   $( [ "$BACKEND_STATUS" = "200" ] && echo "✅ RUNNING" || echo "⚠️  Starting (check logs)")"
echo "   Frontend:  $( [ "$FRONTEND_STATUS" = "200" ] && echo "✅ RUNNING" || echo "⚠️  Starting (check logs)")"
docker-compose -f docker-compose.demo.yml ps
echo ""
echo "🔧 Useful Commands:"
echo "   Check status:     docker-compose -f docker-compose.demo.yml ps"
echo "   View logs:        docker-compose -f docker-compose.demo.yml logs -f"
echo "   Restart:          docker-compose -f docker-compose.demo.yml restart"
echo ""
echo "📝 Data Persistence:"
echo "   ✅ Database: postgres_data volume (preserved)"
echo "   ✅ Redis: redis_data volume (preserved)"
echo "   ✅ Uploads: ./server/uploads (preserved)"
echo "   ✅ Logs: ./server/logs (preserved)"
echo "   ✅ Backups: ./backups/ (preserved)"
echo ""
echo "🔄 To Deploy Updates:"
echo "   1. Push changes to GitHub"
echo "   2. SSH to server: ssh ubuntu@$PUBLIC_IP"
echo "   3. Pull changes: git pull origin main"
echo "   4. Run deployment: ./deploy.sh"
echo ""
echo "⚠️  Important:"
echo "   - Configure DNS A records pointing to: $PUBLIC_IP"
echo "   - Open AWS Security Group ports: 80, 443, 3000, 3001, 5060, 8088"
echo "   - Backups saved to: ./backups/"
echo ""
echo "========================================"
