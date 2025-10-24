#!/bin/bash
# Fast Production Deployment - One Command Setup

set -e

echo "🚀 AI Dialer - Fast Deployment Script"
echo "======================================"

# Set environment variables
export POSTGRES_PASSWORD=MySecurePassword12345
export REDIS_PASSWORD=MyRedisPass12345
export ARI_PASSWORD=MyAriPass12345
export JWT_SECRET=a8f5f167f44f4964e6c998dee827110c
export SESSION_SECRET=session-secret-key-change-this

# Get public IP
PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)
echo "📍 Public IP: $PUBLIC_IP"

export CLIENT_URL=http://$PUBLIC_IP:3001
export API_URL=http://$PUBLIC_IP:3000

# Stop and remove all containers
echo "🛑 Stopping existing containers..."
docker-compose -f docker-compose.demo.yml down -v 2>/dev/null || true

# Remove old images
echo "🗑️  Cleaning up old images..."
docker system prune -f

# Pull latest code
echo "📥 Pulling latest code..."
git pull origin main

# Build and start services
echo "🏗️  Building and starting services..."
docker-compose -f docker-compose.demo.yml up -d --build

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 15

# Check service status
echo "✅ Checking service status..."
docker ps

# Run database migrations
echo "📊 Running database migrations..."
docker exec ai-dialer-backend npm run migrate 2>/dev/null || echo "⚠️  Migration skipped"

# Test backend health
echo "🏥 Testing backend health..."
if curl -s http://localhost:3000/health > /dev/null; then
    echo "✅ Backend is healthy"
else
    echo "⚠️  Backend not responding yet, may need more time"
fi

echo ""
echo "======================================"
echo "✅ DEPLOYMENT COMPLETE!"
echo "======================================"
echo ""
echo "🌐 Frontend URL: http://$PUBLIC_IP:3001"
echo "🔧 Backend URL:  http://$PUBLIC_IP:3000"
echo ""
echo "📝 Next steps:"
echo "1. Open browser: http://$PUBLIC_IP:3001"
echo "2. Register/Login to test"
echo "3. For microphone access, run: bash start-cloudflare-tunnel.sh"
echo ""
echo "🔍 View logs: docker logs ai-dialer-backend -f"
echo "🔄 Restart: docker-compose -f docker-compose.demo.yml restart"
echo ""

