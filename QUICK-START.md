# AI Dialer - Quick Start Guide

## Prerequisites
- Docker Desktop installed and running
- Telnyx account (for actual calling)

## Quick Setup (5 minutes)

### 1. Configure Environment
```bash
# Copy environment template
copy env.example .env

# Edit .env with your credentials
# Required: TELNYX_USERNAME, TELNYX_PASSWORD, TELNYX_CALLER_ID
# Optional: GOOGLE_TTS_API_KEY (for human-like voice)
```

### 2. Start the System
```bash
# Windows
start.bat

# Or manually
docker-compose up -d
docker-compose exec ai_dialer npm run migrate
docker-compose exec ai_dialer npm run seed
docker-compose exec -d ai_dialer node server/asterisk/ai-dialer-app.js
```

### 3. Test the API
```bash
node test-api.js
```

### 4. Access the System
- **API**: http://localhost:3000
- **Health Check**: http://localhost:3000/health
- **Asterisk ARI**: http://localhost:8088/ari

## What's Working

✅ **Backend API** - Complete REST API with authentication
✅ **Database** - PostgreSQL with all tables and relationships
✅ **Caching** - Redis for session management
✅ **Asterisk PBX** - Self-hosted telephony system
✅ **TTS Integration** - Google Cloud TTS for human-like voice
✅ **Telnyx Integration** - SIP trunking for call delivery
✅ **ARI Application** - Real-time call control
✅ **WebSocket** - Real-time monitoring

## Next Steps

1. **Connect Frontend** - Your React app can now connect to the API
2. **Configure Telnyx** - Add your Telnyx credentials to .env
3. **Test Calls** - Create campaigns and start making AI calls
4. **Monitor** - Use the web interface to monitor calls in real-time

## Troubleshooting

**Services not starting?**
```bash
docker-compose logs -f
```

**Database issues?**
```bash
docker-compose exec postgres psql -U postgres -d ai_dialer
```

**Asterisk issues?**
```bash
docker-compose exec asterisk asterisk -r
```

## API Endpoints

- `POST /api/v1/auth/register` - Register user
- `POST /api/v1/auth/login` - Login
- `GET /api/v1/campaigns` - List campaigns
- `POST /api/v1/campaigns` - Create campaign
- `GET /api/v1/contacts` - List contacts
- `POST /api/v1/contacts` - Add contact
- `POST /api/v1/calls/start` - Start a call
- `GET /api/v1/calls` - List calls
- `GET /api/v1/analytics/dashboard` - Get analytics

The system is now ready for your frontend integration!
