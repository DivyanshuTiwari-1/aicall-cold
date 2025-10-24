#!/bin/bash

echo "========================================="
echo "AI Dialer - Production Connectivity Test"
echo "========================================="
echo ""

# Get server IP
if [ -f /sys/hypervisor/uuid ] && grep -q "ec2" /sys/hypervisor/uuid 2>/dev/null; then
    SERVER_IP=$(curl -s ifconfig.me)
else
    SERVER_IP="localhost"
fi

echo "Server IP: $SERVER_IP"
echo ""

# Test backend health
echo "1. Testing Backend Health..."
BACKEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://$SERVER_IP:3000/health)
if [ "$BACKEND_STATUS" = "200" ]; then
    echo "   ✅ Backend is healthy (HTTP $BACKEND_STATUS)"
else
    echo "   ❌ Backend is not responding (HTTP $BACKEND_STATUS)"
fi

# Test frontend
echo ""
echo "2. Testing Frontend..."
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://$SERVER_IP:3001)
if [ "$FRONTEND_STATUS" = "200" ]; then
    echo "   ✅ Frontend is accessible (HTTP $FRONTEND_STATUS)"
else
    echo "   ❌ Frontend is not responding (HTTP $FRONTEND_STATUS)"
fi

# Test API proxy through frontend
echo ""
echo "3. Testing API Proxy (Frontend → Backend)..."
API_PROXY_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://$SERVER_IP:3001/api/v1/auth/health 2>/dev/null || echo "000")
if [ "$API_PROXY_STATUS" = "200" ] || [ "$API_PROXY_STATUS" = "404" ]; then
    echo "   ✅ API proxy is working (nginx can reach backend)"
else
    echo "   ⚠️  API proxy returned HTTP $API_PROXY_STATUS (may need auth)"
fi

# Test WebSocket endpoint
echo ""
echo "4. Testing WebSocket Proxy..."
WS_TEST=$(curl -s -o /dev/null -w "%{http_code}" http://$SERVER_IP:3001/ws 2>/dev/null)
if [ "$WS_TEST" != "000" ]; then
    echo "   ✅ WebSocket endpoint is accessible"
else
    echo "   ❌ WebSocket endpoint is not responding"
fi

# Test database connection
echo ""
echo "5. Testing Database Connection..."
DB_TEST=$(docker exec ai-dialer-backend node -e "
const {query} = require('./config/database');
query('SELECT 1').then(() => {
    console.log('ok');
    process.exit(0);
}).catch(e => {
    console.log('error');
    process.exit(1);
});" 2>/dev/null)

if [ "$DB_TEST" = "ok" ]; then
    echo "   ✅ Database connection is working"
else
    echo "   ❌ Database connection failed"
fi

# Test Redis connection
echo ""
echo "6. Testing Redis Connection..."
REDIS_TEST=$(docker exec ai-dialer-backend node -e "
const redis = require('redis');
const client = redis.createClient({
    host: process.env.REDIS_HOST || 'redis',
    port: process.env.REDIS_PORT || 6379
});
client.on('error', () => {
    console.log('error');
    process.exit(1);
});
client.on('ready', () => {
    console.log('ok');
    client.quit();
    process.exit(0);
});
client.connect();
" 2>/dev/null)

if [ "$REDIS_TEST" = "ok" ]; then
    echo "   ✅ Redis connection is working"
else
    echo "   ❌ Redis connection failed"
fi

# Check container status
echo ""
echo "7. Container Status:"
docker-compose -f docker-compose.demo.yml ps 2>/dev/null | grep -E "(frontend|backend|postgres|redis|asterisk)"

echo ""
echo "========================================="
echo "Test Complete!"
echo "========================================="
echo ""
echo "URLs:"
echo "  Frontend:  http://$SERVER_IP:3001"
echo "  Backend:   http://$SERVER_IP:3000"
echo "  API Docs:  http://$SERVER_IP:3000/api/v1/docs"
echo ""
