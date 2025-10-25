#!/bin/bash
set -e

#################################################
# Simplified AI Dialer Deployment
# Cost: ~$0.0045/minute with human-like voice
# Features: Piper TTS + Vosk STT + Intelligent Scripts
#################################################

echo "================================================"
echo "🚀 Simplified AI Dialer Deployment"
echo "Human-like voice at ~$0.0045/minute"
echo "================================================"
echo ""

# Check if .env.production exists
if [ ! -f .env.production ]; then
    echo "📝 Creating .env.production from example..."
    cp .env.simplified.example .env.production
    echo "⚠️  IMPORTANT: Edit .env.production with your Telnyx credentials!"
    echo ""
    read -p "Press Enter after you've configured .env.production..."
fi

# Load environment
echo "📝 Loading environment..."
set -a
source .env.production
set +a

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p models/piper models/vosk audio audio-cache logs

# Check if voice models exist
echo "🎤 Checking voice models..."
NEED_MODELS=false

if [ ! -f "models/piper/en_US-amy-medium.onnx" ]; then
    echo "   ⚠️  Piper TTS models not found"
    NEED_MODELS=true
fi

if [ ! -d "models/vosk/vosk-model-small-en-us-0.15" ]; then
    echo "   ⚠️  Vosk STT model not found"
    NEED_MODELS=true
fi

if [ "$NEED_MODELS" = true ]; then
    echo ""
    echo "📥 Voice models missing!"
    echo "   Models will be downloaded during Docker build (~2GB)"
    echo "   This is a ONE-TIME download and will be cached."
    echo ""
    read -p "Continue with model download? (yes/no): " download
    if [ "$download" != "yes" ]; then
        echo "Deployment cancelled."
        exit 0
    fi
fi

# Build Docker images
echo ""
echo "🔨 Building Docker images..."
docker-compose -f docker-compose.simplified.yml build

# Start services
echo ""
echo "🚀 Starting services..."
docker-compose -f docker-compose.simplified.yml up -d

# Wait for services
echo ""
echo "⏳ Waiting for services to start (30 seconds)..."
sleep 30

# Health checks
echo ""
echo "🔍 Checking service health..."

# Check PostgreSQL
PG_HEALTHY=$(docker exec ai-dialer-postgres pg_isready -U ${POSTGRES_USER} 2>&1 || echo "failed")
if [[ "$PG_HEALTHY" == *"accepting connections"* ]]; then
    echo "   ✅ PostgreSQL: HEALTHY"
else
    echo "   ❌ PostgreSQL: UNHEALTHY"
    exit 1
fi

# Check Redis
REDIS_HEALTHY=$(docker exec ai-dialer-redis redis-cli ping 2>&1 || echo "failed")
if [[ "$REDIS_HEALTHY" == "PONG" ]]; then
    echo "   ✅ Redis: HEALTHY"
else
    echo "   ❌ Redis: UNHEALTHY"
fi

# Check Backend
BACKEND_HEALTHY=false
for i in {1..10}; do
    if curl -f -s http://localhost:3000/health > /dev/null 2>&1; then
        BACKEND_HEALTHY=true
        break
    fi
    sleep 3
done

if [ "$BACKEND_HEALTHY" = true ]; then
    echo "   ✅ Backend: HEALTHY"
else
    echo "   ❌ Backend: UNHEALTHY"
    echo ""
    echo "Backend logs:"
    docker logs ai-dialer-backend --tail 50
    exit 1
fi

# Check Speech Services
PIPER_VERSION=$(docker exec ai-dialer-speech piper --version 2>&1 || echo "failed")
if [[ "$PIPER_VERSION" != "failed" ]]; then
    echo "   ✅ Piper TTS: HEALTHY ($PIPER_VERSION)"
else
    echo "   ⚠️  Piper TTS: CHECK NEEDED"
fi

# Check Frontend
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001)
if [ "$FRONTEND_STATUS" = "200" ]; then
    echo "   ✅ Frontend: HEALTHY"
else
    echo "   ⚠️  Frontend: CHECK NEEDED (Status: $FRONTEND_STATUS)"
fi

# Run migrations
echo ""
echo "🔄 Running database migrations..."
docker exec ai-dialer-backend npm run migrate 2>&1 | tail -10

# Test voice generation
echo ""
echo "🎤 Testing voice generation..."
docker exec ai-dialer-backend node -e "
const piper = require('./services/piper-tts');
piper.generateSpeech('Hello, this is a test of the simplified system with human-like voice.', {voice: 'amy'})
  .then(r => console.log('   ✅ Piper TTS: Working'))
  .catch(e => console.error('   ❌ Piper TTS: Failed -', e.message));
" || echo "   ⚠️  Voice test failed (may work during actual calls)"

# Get public IP
PUBLIC_IP=$(curl -s ifconfig.me || echo "localhost")

# Success!
echo ""
echo "================================================"
echo "✅ SIMPLIFIED DEPLOYMENT COMPLETE!"
echo "================================================"
echo ""
echo "📊 System Status:"
docker-compose -f docker-compose.simplified.yml ps
echo ""
echo "🌐 Access Your System:"
echo "   Frontend:  http://$PUBLIC_IP:3001"
echo "   Backend:   http://$PUBLIC_IP:3000"
echo ""
echo "💰 Cost Information:"
echo "   Telnyx SIP:  ~$0.004-0.005/minute"
echo "   Piper TTS:   $0.00/minute (self-hosted)"
echo "   Vosk STT:    $0.00/minute (self-hosted)"
echo "   TOTAL:       ~$0.0045/minute"
echo ""
echo "🎤 Voice Quality:"
echo "   Using Piper TTS (Amy voice)"
echo "   Human-like, natural sounding"
echo "   Commercial quality at $0 cost"
echo ""
echo "📖 Next Steps:"
echo "   1. Login to the frontend"
echo "   2. Create a campaign with a script"
echo "   3. Upload contacts"
echo "   4. Assign a Telnyx number"
echo "   5. Start automated calling!"
echo ""
echo "📚 Documentation:"
echo "   Setup Guide:    SIMPLIFIED_SETUP_GUIDE.md"
echo ""
echo "🔧 Useful Commands:"
echo "   View logs:      docker-compose -f docker-compose.simplified.yml logs -f"
echo "   Stop:           docker-compose -f docker-compose.simplified.yml down"
echo "   Restart:        docker-compose -f docker-compose.simplified.yml restart"
echo ""
echo "✨ Enjoy your cost-effective calling system!"
echo "================================================"




