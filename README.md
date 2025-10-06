# 🚀 AI Dialer Pro - Complete Cold Calling Solution

A comprehensive AI-powered cold calling web application built with React and Node.js, featuring emotion detection, real-time monitoring, and intelligent automation.

## ✨ Features

### Core Features
- ✅ **Automated Calling Engine** - Twilio-powered outbound calling
- ✅ **Real-time Transcription** - OpenAI Whisper integration
- ✅ **Emotion Detection** - AI-powered sentiment analysis
- ✅ **Intent Scoring** - NLP-based lead qualification
- ✅ **Voice Personas** - Multiple AI voice personalities
- ✅ **Custom Voice Cloning** - ElevenLabs integration
- ✅ **Knowledge Base** - FAQ-powered responses
- ✅ **DNC Management** - Compliance-first architecture

### Advanced Features
- ✅ **Whisper Mode** - Agent monitoring without customer awareness
- ✅ **Seamless Handoff** - Warm transfer with full context
- ✅ **Objection Handlers** - Real-time battle cards
- ✅ **Competitor Intel** - Automatic detection & response
- ✅ **Best Time Prediction** - ML-powered call scheduling
- ✅ **Auto-Retry Logic** - Smart retry based on outcomes
- ✅ **CSAT Integration** - Post-call satisfaction surveys
- ✅ **Script Optimization** - AI recommendations

### Analytics & Reporting
- ✅ **Executive Dashboard** - KPIs and ROI metrics
- ✅ **Cost per Lead** - Real-time cost tracking
- ✅ **Conversion Funnels** - Visual analytics
- ✅ **Emotion Analytics** - Aggregate sentiment tracking

## 🛠️ Tech Stack

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: PostgreSQL 15
- **Cache/Queue**: Redis 7
- **Telephony**: Twilio
- **Voice AI**: ElevenLabs
- **Speech-to-Text**: OpenAI Whisper
- **NLP**: OpenAI GPT-4
- **WebSockets**: ws
- **Job Queue**: Bull

### Frontend
- **Framework**: React 18
- **Routing**: React Router DOM
- **State Management**: React Query
- **UI**: Tailwind CSS
- **Icons**: Heroicons
- **Charts**: Recharts
- **Notifications**: React Hot Toast

## 📦 Prerequisites

Before you begin, ensure you have:
- Node.js (v18 or higher)
- PostgreSQL (v15 or higher)
- Redis (v7 or higher)
- Twilio Account (with phone number)
- OpenAI API Key
- ElevenLabs API Key (optional for custom voices)

## 🔧 Installation

### 1. Clone Repository
```bash
git clone https://github.com/your-org/ai-dialer-pro.git
cd ai-dialer-pro
```

### 2. Install Dependencies
```bash
npm run install:all
```

### 3. Environment Setup
```bash
# Copy environment file
cp server/env.example server/.env

# Edit with your credentials
nano server/.env
```

### 4. Database Setup
```bash
# Create database
createdb ai_dialer

# Run migrations
npm run migrate

# Seed sample data (optional)
npm run seed
```

## ⚙️ Configuration

### Required Environment Variables
```env
# Server Configuration
NODE_ENV=development
PORT=3000

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ai_dialer
DB_USER=postgres
DB_PASSWORD=your_password

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT Configuration
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRES_IN=24h

# Twilio Configuration (Required)
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# OpenAI Configuration (Required)
OPENAI_API_KEY=sk-your-openai-key

# ElevenLabs Configuration (Optional)
ELEVENLABS_API_KEY=your_elevenlabs_key

# Emotion Detection (Optional)
EMOTION_API_KEY=your_emotion_api_key

# CRM Integrations (Optional)
SALESFORCE_CLIENT_ID=your_salesforce_id
HUBSPOT_API_KEY=your_hubspot_key
```

## 🚀 Running the Application

### Development Mode
```bash
# Start all services
npm run dev

# Or start individually
npm run server:dev  # Backend on http://localhost:3000
npm run client:dev  # Frontend on http://localhost:3001
```

### Production Mode
```bash
# Build and start
npm run build
npm start
```

### Self-Hosted Voice Stack (Low-cost)
```bash
# 1) Start databases (Postgres/Redis)
docker-compose -f docker-compose.dev.yml up -d

# 2) Start telephony + AI services (Asterisk/ASR/LLM/TTS)
docker-compose -f docker-compose.selfhost.yml up -d

# 3) Configure backend to use self-hosted
copy server\env.example server\.env
# Edit server\.env:
# VOICE_STACK=self_hosted
# ARI_URL=http://localhost:8088
# ARI_USER=ari_user
# ARI_PASS=ari_password
# ASR_URL=http://localhost:8001
# LLM_URL=http://localhost:8002
# TTS_URL=http://localhost:8003

# 4) Migrate + seed
npm run migrate
npm run seed

# 5) Start app
npm run dev
```

See `SELF_HOSTING.md` for detailed steps.

### Using Docker
```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f api

# Stop services
docker-compose down
```

## 📚 API Documentation

### Authentication
All API endpoints require authentication (except health check).

**Login:**
```bash
POST /api/v1/auth/login
Content-Type: application/json
{
  "email": "user@example.com",
  "password": "password"
}
```

**Response:**
```json
{
  "success": true,
  "token": "jwt_token_here",
  "user": { ... }
}
```

### Campaigns
**Create Campaign:**
```bash
POST /api/v1/campaigns
Authorization: Bearer <token>
{
  "organization_id": "uuid",
  "name": "Q4 Sales Outreach",
  "type": "sales",
  "voice_persona": "professional",
  "auto_retry": true,
  "best_time_enabled": true,
  "emotion_detection": true
}
```

**Get Campaigns:**
```bash
GET /api/v1/campaigns?organization_id=uuid&status=active
```

### Contacts
**Bulk Upload:**
```bash
POST /api/v1/contacts/bulk
{
  "organization_id": "uuid",
  "campaign_id": "uuid",
  "contacts": [
    {
      "first_name": "John",
      "phone": "+1234567890",
      "email": "john@example.com",
      "company": "TechCorp"
    }
  ]
}
```

### Calls
**Start Call:**
```bash
POST /api/v1/calls/start
{
  "organization_id": "uuid",
  "campaign_id": "uuid",
  "contact_id": "uuid"
}
```

**Complete Call:**
```bash
POST /api/v1/calls/complete
{
  "call_id": "uuid",
  "status": "completed",
  "outcome": "scheduled",
  "duration": 245,
  "transcript": "Full transcript...",
  "emotion": "interested",
  "intent_score": 0.85,
  "csat_score": 4.5
}
```

### Analytics
**Dashboard Stats:**
```bash
GET /api/v1/analytics/dashboard?organization_id=uuid
```

**ROI Calculator:**
```bash
GET /api/v1/analytics/roi?organization_id=uuid&campaign_id=uuid
```

### DNC Management
**Check DNC:**
```bash
POST /api/v1/dnc/check
{
  "organization_id": "uuid",
  "phone": "+1234567890"
}
```

**Add to DNC:**
```bash
POST /api/v1/dnc/add
{
  "organization_id": "uuid",
  "phone": "+1234567890",
  "reason": "User requested"
}
```

### Knowledge Base
**Query KB:**
```bash
POST /api/v1/knowledge/query
{
  "organization_id": "uuid",
  "question": "What is your pricing?"
}
```

**Response:**
```json
{
  "success": true,
  "answer": "Our pricing starts at $99/month",
  "confidence": 0.92,
  "should_fallback": false
}
```

### ML Features
**Best Time Prediction:**
```bash
GET /api/v1/ml/best-time/:contact_id
```

**Script Optimization:**
```bash
GET /api/v1/ml/optimize-script/:script_id
```

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Frontend (React)                                            │
│ WebSocket + REST API Communication                          │
└────────────────────┬───────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│ API Gateway (Express)                                       │
│ ┌──────────────┬──────────────┬──────────────────────────┐   │
│ │ Auth & JWT   │ Rate Limiter │ Request Validation      │   │
│ └──────────────┴──────────────┴──────────────────────────┘   │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
┌───────▼──────┐ ┌──▼────────┐ ┌─▼──────────────┐
│ PostgreSQL   │ │ Redis     │ │ Twilio API     │
│ Database     │ │ Cache &   │ │ Telephony      │
│              │ │ Queue     │ │                │
└──────────────┘ └───────────┘ └────────────────┘
        │            │            │
        └────────────┼────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
┌───────▼──────┐ ┌──▼────────┐ ┌─▼──────────────┐
│ OpenAI       │ │ ElevenLabs│ │ Hume AI        │
│ Whisper STT  │ │ Voice     │ │ Emotion        │
│              │ │ Synthesis │ │ Detection      │
└──────────────┘ └───────────┘ └────────────────┘
```

## 🔒 Security

- JWT-based authentication
- Rate limiting on all endpoints
- Input validation with Joi
- SQL injection prevention (parameterized queries)
- XSS protection with Helmet
- PII encryption at rest (AES-256)
- HTTPS enforced in production
- CORS configured
- Audit logging for compliance

## 📊 Monitoring

**Health Check:**
```bash
GET /health
```

**Metrics:**
- Request latency
- Error rates
- Call success rates
- Credits consumed
- Queue depth

**Logging:**
Uses Winston for structured logging:
- `logs/app.log` - Application logs
- `logs/error.log` - Error logs
- Console output in development

## 🚢 Deployment

### Heroku
```bash
heroku create ai-dialer-api
heroku addons:create heroku-postgresql:hobby-dev
heroku addons:create heroku-redis:hobby-dev
heroku config:set TWILIO_ACCOUNT_SID=xxx
git push heroku main
```

### AWS EC2
```bash
# Install dependencies
sudo apt update
sudo apt install nodejs npm postgresql redis-server

# Clone and setup
git clone <repo>
cd ai-dialer-backend
npm install
npm run migrate

# Start with PM2
pm2 start server.js --name ai-dialer-api
```

### Docker
```bash
docker build -t ai-dialer-api .
docker run -p 3000:3000 --env-file .env ai-dialer-api
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test
npm test -- campaigns.test.js
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

- Documentation: https://docs.ai-dialer.com
- Email: support@ai-dialer.com
- Slack: https://ai-dialer.slack.com

## 🎯 Roadmap

- [ ] Multi-language support (Hindi, Spanish)
- [ ] Video calling capabilities
- [ ] Advanced analytics dashboard
- [ ] Mobile SDK
- [ ] Zapier integration
- [ ] Chrome extension

---

**Built with ❤️ by AI Dialer Team**
