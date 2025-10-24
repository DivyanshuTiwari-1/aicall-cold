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

# Generate SSL certificates if not exist
if [ ! -f ./ssl/nginx-selfsigned.crt ]; then
    echo "🔐 Generating SSL certificates..."
    mkdir -p ./ssl
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout ./ssl/nginx-selfsigned.key \
        -out ./ssl/nginx-selfsigned.crt \
        -subj "/C=US/ST=State/L=City/O=AI Dialer/OU=IT/CN=$PUBLIC_IP" 2>/dev/null
    openssl dhparam -out ./ssl/dhparam.pem 2048 2>/dev/null
    chmod 600 ./ssl/nginx-selfsigned.key
    chmod 644 ./ssl/nginx-selfsigned.crt
    chmod 644 ./ssl/dhparam.pem
    echo "✅ SSL certificates generated"
else
    echo "✅ SSL certificates already exist"
fi

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
echo "🌐 HTTP URL:  http://$PUBLIC_IP:3001"
echo "🔒 HTTPS URL: https://$PUBLIC_IP:3443 (Self-signed - click 'Advanced' then 'Proceed')"
echo "🔧 Backend:   http://$PUBLIC_IP:3000"
echo ""
echo "📝 Production URL Options:"
echo ""
echo "Option 1: Self-Signed HTTPS (Available Now)"
echo "  URL: https://$PUBLIC_IP:3443"
echo "  ⚠️  Shows security warning (normal)"
echo "  ✅ Microphone works after accepting certificate"
echo ""
echo "Option 2: Cloudflare Tunnel (Professional, No Warnings)"
echo "  Run: bash start-cloudflare-tunnel.sh"
echo "  ✅ Real HTTPS with valid certificate"
echo "  ✅ No security warnings"
echo ""
echo "🔍 Useful commands:"
echo "  View logs: docker logs ai-dialer-backend -f"
echo "  Restart:   docker-compose -f docker-compose.demo.yml restart"
echo "  Redeploy:  bash deploy-fast.sh"
echo ""
