#!/bin/bash
set -e

echo "=== AI Dialer Quick Deploy ==="
cd /opt/ai-dialer

# Get server IP
SERVER_IP=$(curl -s ifconfig.me)
echo "Server IP: $SERVER_IP"

# Generate secrets
JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')
DB_PASSWORD=$(openssl rand -base64 32 | tr -d '\n' | tr -d '=+/' | cut -c1-25)
REDIS_PASSWORD=$(openssl rand -base64 32 | tr -d '\n' | tr -d '=+/' | cut -c1-25)
SESSION_SECRET=$(openssl rand -base64 32 | tr -d '\n')
ARI_PASSWORD=$(openssl rand -base64 16 | tr -d '\n' | tr -d '=+/' | cut -c1-16)

# Create .env.production
cat > .env.production << EOF
NODE_ENV=production
SERVER_IP=$SERVER_IP
DOMAIN=$SERVER_IP
API_URL=http://$SERVER_IP:3000
CLIENT_URL=http://$SERVER_IP:3001
CORS_ORIGIN=http://$SERVER_IP:3001,http://$SERVER_IP:3000,http://localhost:3001

# Telnyx Configuration
TELNYX_SIP_USERNAME=userinfo63399
TELNYX_SIP_PASSWORD=-WUgqhX.ZXYM
TELNYX_CALLER_ID=+18058690081
TELNYX_PHONE_NUMBER=+18058690081
TELNYX_DOMAIN=sip.telnyx.com
TELNYX_USERNAME=info@pitchnhire.com
TELNYX_PASSWORD=DxZU\$m4#GuFhRTp
TELNYX_SIP_URI=sip:info@pitchnhire.com@sip.telnyx.com
TELNYX_IP_RANGE=66.109.0.0/16
TELNYX_DID=+12025550123
TELNYX_TIMEOUT=30

POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=ai_dialer_prod
POSTGRES_USER=ai_dialer_user
POSTGRES_PASSWORD=$DB_PASSWORD
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=$REDIS_PASSWORD
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=7d
SESSION_SECRET=$SESSION_SECRET
TELNYX_API_KEY=your_api_key_here
TELNYX_SIP_USERNAME=your_username_here
TELNYX_SIP_PASSWORD=your_password_here
TELNYX_DOMAIN=sip.telnyx.com
TELNYX_DID=+1234567890
TELNYX_PHONE_NUMBER=+1234567890
TELNYX_CALLER_ID=+1234567890
ARI_URL=http://asterisk:8088/ari
ARI_USERNAME=ai-dialer
ARI_PASSWORD=$ARI_PASSWORD
PORT=3000
FRONTEND_PORT=3001
LOG_LEVEL=info
MAX_CONCURRENT_CALLS=10
CALL_INTERVAL_MS=30000
MAX_RETRY_ATTEMPTS=3
MAX_FILE_SIZE=10485760
UPLOAD_DIR=/app/uploads
EOF

echo "✓ Environment configured"

# Configure firewall
echo "Configuring firewall..."
sudo ufw allow 22/tcp
sudo ufw allow 3000/tcp
sudo ufw allow 3001/tcp
sudo ufw allow 5060/udp
sudo ufw allow 8088/tcp
sudo ufw allow 10000:10100/udp
sudo ufw --force enable
echo "✓ Firewall configured"

# Export environment variables for docker-compose
export POSTGRES_PASSWORD=$DB_PASSWORD
export REDIS_PASSWORD=$REDIS_PASSWORD
export ARI_PASSWORD=$ARI_PASSWORD
export CLIENT_URL=http://$SERVER_IP:3001
export API_URL=http://$SERVER_IP:3000
export JWT_SECRET=$JWT_SECRET
export SESSION_SECRET=$SESSION_SECRET

# Build and start services
echo "Building and starting services (this takes 5-10 minutes)..."
docker-compose -f docker-compose.demo.yml up -d --build

# Wait for backend
echo "Waiting for backend to start..."
sleep 30
for i in {1..30}; do
    if curl -f http://localhost:3000/health 2>/dev/null; then
        echo "✓ Backend is ready"
        break
    fi
    echo -n "."
    sleep 2
done

# Run migrations
echo "Running database migrations..."
sleep 10
docker exec ai-dialer-backend npm run migrate || echo "Migrations may have already run"

# Create admin user
echo "Creating admin user..."
docker exec ai-dialer-backend node -e "
const { query } = require('./config/database');
const bcrypt = require('bcryptjs');
async function createAdmin() {
    try {
        const hashedPassword = await bcrypt.hash('Admin123!', 10);
        await query(\`
            INSERT INTO users (email, password, first_name, last_name, role, organization_id)
            VALUES (\$1, \$2, \$3, \$4, \$5, (SELECT id FROM organizations LIMIT 1))
            ON CONFLICT (email) DO NOTHING
        \`, ['admin@demo.com', hashedPassword, 'Admin', 'User', 'admin']);
        console.log('✓ Admin user created');
    } catch(e) {
        console.log('Admin user may already exist');
    }
    process.exit(0);
}
createAdmin();
" 2>/dev/null || echo "Admin user may already exist"

echo ""
echo "========================================="
echo "🎉 DEPLOYMENT COMPLETE!"
echo "========================================="
echo ""
echo "Access your app at:"
echo "  Frontend: http://$SERVER_IP:3001"
echo "  API:      http://$SERVER_IP:3000"
echo ""
echo "Login credentials:"
echo "  Email:    admin@demo.com"
echo "  Password: Admin123!"
echo ""
echo "========================================="
