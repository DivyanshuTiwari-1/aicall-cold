#!/bin/bash
set -e

#################################################
# AI Dialer - Production Deployment Script
# This script deploys the app to production EC2
# WITHOUT affecting your local development setup
#################################################

echo "========================================"
echo "AI Dialer - Production Deployment"
echo "========================================"
echo ""

# Check if running on EC2 (production)
if [ ! -f /sys/hypervisor/uuid ] || ! grep -q "ec2" /sys/hypervisor/uuid 2>/dev/null; then
    echo "⚠️  WARNING: This doesn't look like an EC2 instance."
    echo "This script is for PRODUCTION deployment only."
    read -p "Continue anyway? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        echo "Deployment cancelled."
        exit 0
    fi
fi

# Get public IP
echo "🔍 Detecting server IP..."
PUBLIC_IP=$(curl -s ifconfig.me || echo "localhost")
echo "   Server IP: $PUBLIC_IP"
echo ""

# Generate secure passwords
echo "🔐 Generating secure passwords..."
DB_PASSWORD=$(openssl rand -base64 32 | tr -d '\n' | tr -d '=+/' | cut -c1-32)
REDIS_PASSWORD=$(openssl rand -base64 32 | tr -d '\n' | tr -d '=+/' | cut -c1-32)
ARI_PASSWORD=$(openssl rand -base64 16 | tr -d '\n' | tr -d '=+/' | cut -c1-16)
JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')
SESSION_SECRET=$(openssl rand -base64 32 | tr -d '\n')
echo "   ✓ Passwords generated"
echo ""

# Create .env.production for backend
echo "📝 Creating production environment file..."
cat > .env.production << EOF
# Production Environment Configuration
NODE_ENV=production
PORT=3000

# Database Configuration
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=ai_dialer_prod
POSTGRES_USER=ai_dialer_user
POSTGRES_PASSWORD=$DB_PASSWORD

# Also support DB_* format for backwards compatibility
DB_HOST=postgres
DB_PORT=5432
DB_NAME=ai_dialer_prod
DB_USER=ai_dialer_user
DB_PASSWORD=$DB_PASSWORD

# Redis Configuration
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=$REDIS_PASSWORD

# Asterisk Configuration
ASTERISK_HOST=asterisk
ASTERISK_ARI_PORT=8088
ARI_URL=http://asterisk:8088/ari
ARI_USERNAME=ai-dialer
ARI_PASSWORD=$ARI_PASSWORD

# JWT & Session
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=7d
SESSION_SECRET=$SESSION_SECRET

# Application Settings
LOG_LEVEL=info
MAX_FILE_SIZE=10485760
UPLOAD_DIR=/app/uploads
MAX_CONCURRENT_CALLS=10
CALL_INTERVAL_MS=30000
MAX_RETRY_ATTEMPTS=3

# API URLs
API_URL=http://$PUBLIC_IP:3000
CLIENT_URL=http://$PUBLIC_IP:3001
FRONTEND_URL=http://$PUBLIC_IP:3001

# Add your API keys here
OPENAI_API_KEY=your-openai-api-key-here
TELNYX_API_KEY=your-telnyx-api-key-here
EOF

# Create production-specific ARI config
echo "   ✓ Creating Asterisk ARI config..."
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

echo "   ✓ Environment configured"
echo ""

# Configure firewall
echo "🔥 Configuring firewall..."
sudo ufw allow 22/tcp comment 'SSH' 2>/dev/null || true
sudo ufw allow 3000/tcp comment 'Backend API' 2>/dev/null || true
sudo ufw allow 3001/tcp comment 'Frontend' 2>/dev/null || true
sudo ufw allow 5060/udp comment 'SIP' 2>/dev/null || true
sudo ufw allow 8088/tcp comment 'Asterisk ARI' 2>/dev/null || true
sudo ufw allow 10000:10100/udp comment 'RTP Media' 2>/dev/null || true
echo "   ✓ Firewall configured"
echo ""

# Export environment variables for docker-compose
export POSTGRES_PASSWORD=$DB_PASSWORD
export REDIS_PASSWORD=$REDIS_PASSWORD
export ARI_PASSWORD=$ARI_PASSWORD

# Stop existing containers and remove old volumes
echo "🛑 Stopping existing containers..."
docker-compose -f docker-compose.demo.yml down -v 2>/dev/null || true
echo "   ✓ Cleaned up old containers"
echo ""

# Build and start services
echo "🚀 Building and starting services..."
echo "   (This takes 3-5 minutes on first run)"
docker-compose -f docker-compose.demo.yml build --no-cache
docker-compose -f docker-compose.demo.yml up -d
echo "   ✓ Services started"
echo ""

# Wait for services to be ready
echo "⏳ Waiting for services to initialize (60 seconds)..."
sleep 60

# Check service status
echo ""
echo "📊 Service Status:"
docker-compose -f docker-compose.demo.yml ps

# Wait for backend to be healthy
echo ""
echo "⏳ Waiting for backend to be ready..."
for i in {1..30}; do
    if curl -f http://localhost:3000/health 2>/dev/null; then
        echo "   ✓ Backend is ready!"
        break
    fi
    echo -n "."
    sleep 3
done
echo ""

# Run database migrations
echo ""
echo "🔄 Running database migrations..."
docker exec ai-dialer-backend npm run migrate 2>&1 | tail -10 || echo "   Migrations may have already run"

# Create default organization
echo ""
echo "🏢 Creating default organization..."
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
echo ""
echo "👤 Creating admin user..."
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
        \`, ['admin@demo.com', hashedPassword, 'Admin', 'User', 'admin']);
        console.log('   ✓ Admin user created: admin@demo.com / Admin123!');
    } catch(e) {
        console.log('   Admin user may already exist:', e.message);
    }
    process.exit(0);
})();
" 2>&1

# Final health check
echo ""
echo "🔍 Final health check..."
sleep 5

BACKEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health)
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001)

echo ""
echo "========================================"
echo "🎉 DEPLOYMENT COMPLETE!"
echo "========================================"
echo ""
echo "📍 Your Application URLs:"
echo "   Frontend:  http://$PUBLIC_IP:3001"
echo "   Backend:   http://$PUBLIC_IP:3000"
echo ""
echo "🔐 Admin Login:"
echo "   Email:     admin@demo.com"
echo "   Password:  Admin123!"
echo ""
echo "📊 Service Status:"
echo "   Backend:   $( [ "$BACKEND_STATUS" = "200" ] && echo "✅ RUNNING" || echo "❌ CHECK LOGS")"
echo "   Frontend:  $( [ "$FRONTEND_STATUS" = "200" ] && echo "✅ RUNNING" || echo "❌ CHECK LOGS")"
echo ""
echo "🔧 Useful Commands:"
echo "   Check status:     docker-compose -f docker-compose.demo.yml ps"
echo "   View backend logs: docker logs ai-dialer-backend --follow"
echo "   View all logs:    docker-compose -f docker-compose.demo.yml logs --follow"
echo "   Restart services: docker-compose -f docker-compose.demo.yml restart"
echo "   Stop services:    docker-compose -f docker-compose.demo.yml down"
echo ""
echo "⚠️  IMPORTANT: Update these in .env.production:"
echo "   - OPENAI_API_KEY"
echo "   - TELNYX_API_KEY (if using Telnyx)"
echo ""
echo "🔒 Security Note:"
echo "   Make sure AWS Security Group has these ports open:"
echo "   - 3000 (Backend API)"
echo "   - 3001 (Frontend)"
echo "   - 5060/UDP (SIP)"
echo "   - 8088 (Asterisk ARI)"
echo "   - 10000-10100/UDP (RTP Media)"
echo ""
echo "========================================"

