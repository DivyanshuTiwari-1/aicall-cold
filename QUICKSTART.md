# 🚀 AI Dialer Pro - Quick Start Guide

## Prerequisites
- Node.js 18+ installed
- Docker Desktop (recommended) OR PostgreSQL + Redis

## Quick Setup (3 Options)

### Option 1: Docker (Easiest - Recommended)
```bash
# 1. Install Docker Desktop from https://www.docker.com/products/docker-desktop/

# 2. Start all services
docker-compose up -d

# 3. Wait for services to start, then access:
# Frontend: http://localhost:3001
# Backend: http://localhost:3000
# Database Admin: http://localhost:5050 (admin@example.com / admin)
```

### Option 2: Manual Setup
```bash
# 1. Install PostgreSQL from https://www.postgresql.org/download/windows/
# 2. Install Redis or use Docker: docker run -d -p 6379:6379 redis:alpine

# 3. Create database
createdb ai_dialer

# 4. Install dependencies
npm run install:all

# 5. Setup environment
copy server\env.example server\.env
# Edit server\.env with your PostgreSQL password

# 6. Run migrations
npm run migrate
npm run seed

# 7. Start application
npm run dev
```

### Option 3: Run Setup Script
```bash
# Windows Command Prompt
setup.bat

# OR PowerShell
.\setup.ps1
```

## After Setup

### Access Points:
- **Frontend**: http://localhost:3001
- **Backend API**: http://localhost:3000
- **Database Admin**: http://localhost:5050 (pgAdmin)
- **Redis Admin**: http://localhost:8081 (Redis Commander)

### Default Login:
- Email: admin@demo.com
- Password: password123

## Troubleshooting

### "psql: command not found"
- Install PostgreSQL and add to PATH
- OR use Docker option instead

### "Database connection failed"
- Check if PostgreSQL is running
- Verify credentials in server\.env
- Try Docker option: `docker-compose up -d postgres redis`

### "Redis connection failed"
- Install Redis or use: `docker run -d -p 6379:6379 redis:alpine`

## Next Steps

1. **Configure API Keys** in `server\.env`:
   - Twilio (for calling)
   - OpenAI (for AI features)
   - ElevenLabs (for voice cloning)

2. **Create Your First Campaign**:
   - Login to the frontend
   - Go to Campaigns
   - Click "Create Campaign"

3. **Import Contacts**:
   - Go to Contacts
   - Click "Add Contact" or bulk upload

4. **Start Calling**:
   - Select a campaign
   - Choose contacts
   - Start the AI dialer!

## Need Help?

- Check `setup-database.md` for detailed instructions
- Review the main `README.md` for full documentation
- All API endpoints are documented in the README

---

**🎉 You're ready to start AI-powered cold calling!**
