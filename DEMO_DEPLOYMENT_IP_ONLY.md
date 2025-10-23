# AI Dialer Pro - Demo Deployment (IP Address Only)

## 🚀 Deploy for Demo in 20 Minutes (No Domain Required)

This guide will help you deploy AI Dialer for a demo using only an IP address - **no domain name needed!**

---

## Step 1: Get a Server (5 minutes)

### Option A: DigitalOcean (Recommended - Easiest)

1. **Sign up**: https://www.digitalocean.com/
2. **Create Droplet**:
   - Click "Create" → "Droplets"
   - **Image**: Ubuntu 22.04 LTS
   - **Plan**: Basic
   - **CPU**: Regular - $24/mo (4GB RAM, 2 CPUs) or $48/mo (8GB RAM, 4 CPUs)
   - **Region**: Choose closest to you
   - **Authentication**: SSH Key (recommended) or Password
   - Click "Create Droplet"

3. **Get your IP**: Copy the IP address shown (e.g., `159.65.123.45`)

**Cost**: $24-48/month (can delete after demo - charged hourly)

### Option B: AWS EC2

1. **Sign up**: https://aws.amazon.com/
2. **Launch Instance**:
   - **Name**: ai-dialer-demo
   - **AMI**: Ubuntu Server 22.04 LTS
   - **Instance Type**: t3.medium (4GB RAM) or t3.large (8GB RAM)
   - **Key pair**: Create new or select existing
   - **Network**: Allow HTTP (80), HTTPS (443), SSH (22)
   - Click "Launch Instance"

3. **Get your IP**: Copy the "Public IPv4 address"

**Cost**: ~$0.05-0.10/hour (free tier eligible for 12 months)

### Option C: Vultr

1. **Sign up**: https://www.vultr.com/
2. **Deploy Server**:
   - **Server Type**: Cloud Compute
   - **Location**: Choose closest
   - **Image**: Ubuntu 22.04 LTS
   - **Plan**: 4GB RAM ($24/mo) or 8GB RAM ($48/mo)
   - Deploy

3. **Get your IP**: Copy the IP address

### Option D: Local Testing (Free but limited)

Use your own computer (Linux/Mac or WSL on Windows):
```bash
# Your IP will be localhost (127.0.0.1)
# Can only access from your computer
```

---

## Step 2: Install Docker on Server (5 minutes)

### Connect to your server:

```bash
# Replace YOUR_SERVER_IP with your actual IP
ssh root@YOUR_SERVER_IP

# Or if using username:
ssh ubuntu@YOUR_SERVER_IP
```

### Install Docker:

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add your user to docker group (optional, but recommended)
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify installation
docker --version
docker-compose --version
```

**Expected output:**
```
Docker version 24.x.x
Docker Compose version v2.x.x
```

---

## Step 3: Upload Project to Server (3 minutes)

### From your local computer:

```bash
# Navigate to your project directory
cd c:\coding\aicall

# Upload to server (replace YOUR_SERVER_IP)
scp -r ./* root@YOUR_SERVER_IP:/opt/ai-dialer/

# Or if using username:
scp -r ./* ubuntu@YOUR_SERVER_IP:/opt/ai-dialer/
```

**Alternative: Use FTP client (WinSCP, FileZilla)**
1. Connect to YOUR_SERVER_IP
2. Upload all files to `/opt/ai-dialer/`

---

## Step 4: Configure Environment File (5 minutes)

### SSH back to server:

```bash
ssh root@YOUR_SERVER_IP
cd /opt/ai-dialer
```

### Create .env.production file:

```bash
nano .env.production
```

### Paste this configuration (CUSTOMIZE THE VALUES):

```bash
# ============================================
# AI Dialer Demo Configuration (IP-Based)
# ============================================

NODE_ENV=production

# ============================================
# YOUR SERVER IP ADDRESS
# Replace with your actual server IP!
# ============================================
SERVER_IP=YOUR_SERVER_IP_HERE
DOMAIN=${SERVER_IP}
API_URL=http://${SERVER_IP}:3000
CLIENT_URL=http://${SERVER_IP}:3001

# ============================================
# Database Configuration
# Generate strong passwords!
# ============================================
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=ai_dialer_prod
POSTGRES_USER=ai_dialer_user
POSTGRES_PASSWORD=your_strong_db_password_here_123

# ============================================
# Redis Configuration
# ============================================
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=your_strong_redis_password_456

# ============================================
# Security & JWT
# Generate with: openssl rand -base64 64
# ============================================
JWT_SECRET=your_very_long_jwt_secret_here_change_this_to_something_random_789
JWT_EXPIRES_IN=7d
SESSION_SECRET=your_session_secret_here_012

# ============================================
# Telnyx Configuration (REQUIRED for calls)
# Get from: https://portal.telnyx.com/
# ============================================
TELNYX_API_KEY=YOUR_TELNYX_API_KEY
TELNYX_SIP_USERNAME=YOUR_TELNYX_SIP_USERNAME
TELNYX_SIP_PASSWORD=YOUR_TELNYX_SIP_PASSWORD
TELNYX_DOMAIN=sip.telnyx.com
TELNYX_DID=+1234567890
TELNYX_PHONE_NUMBER=+1234567890
TELNYX_CALLER_ID=+1234567890

# ============================================
# Asterisk ARI Configuration
# ============================================
ARI_URL=http://asterisk:8088/ari
ARI_USERNAME=ai-dialer
ARI_PASSWORD=your_ari_password_345

# ============================================
# Application Settings
# ============================================
PORT=3000
FRONTEND_PORT=3001
LOG_LEVEL=info

# Call Queue Settings
MAX_CONCURRENT_CALLS=10
CALL_INTERVAL_MS=30000
MAX_RETRY_ATTEMPTS=3

# File Upload
MAX_FILE_SIZE=10485760
UPLOAD_DIR=/app/uploads
```

### Generate Strong Passwords:

```bash
# Generate JWT Secret
openssl rand -base64 64

# Generate Database Password
openssl rand -base64 32

# Generate Redis Password
openssl rand -base64 32

# Generate Session Secret
openssl rand -base64 32
```

**Copy the outputs and replace in .env.production**

### Get Telnyx Credentials:

1. Go to https://portal.telnyx.com/
2. Sign up for free trial (get $10 credit)
3. Navigate to **Mission Control** → **API Keys** → Create API Key
4. Navigate to **SIP Connections** → View credentials
5. Buy a phone number (costs ~$2/month)

### Save the file:
- Press `Ctrl + X`
- Press `Y`
- Press `Enter`

---

## Step 5: Create Docker Compose for IP Deployment

```bash
cd /opt/ai-dialer
nano docker-compose.demo.yml
```

### Paste this configuration:

```yaml
version: '3.8'

services:
  # PostgreSQL Database
  postgres:
    image: postgres:15-alpine
    container_name: ai-dialer-postgres
    restart: always
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "127.0.0.1:5432:5432"
    networks:
      - ai-dialer-network

  # Redis Cache
  redis:
    image: redis:7-alpine
    container_name: ai-dialer-redis
    restart: always
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    ports:
      - "127.0.0.1:6379:6379"
    networks:
      - ai-dialer-network

  # Asterisk VoIP Server
  asterisk:
    build:
      context: ./asterisk
      dockerfile: Dockerfile
    container_name: ai-dialer-asterisk
    restart: always
    environment:
      ARI_USERNAME: ${ARI_USERNAME:-ai-dialer}
      ARI_PASSWORD: ${ARI_PASSWORD}
    volumes:
      - ./asterisk-config:/etc/asterisk
      - ./asterisk-logs:/var/log/asterisk
    ports:
      - "8088:8088"
      - "5060:5060/udp"
      - "10000-10100:10000-10100/udp"
    networks:
      - ai-dialer-network

  # Backend API Server
  backend:
    build:
      context: ./server
      dockerfile: Dockerfile
    container_name: ai-dialer-backend
    restart: always
    env_file:
      - .env.production
    volumes:
      - ./server/uploads:/app/uploads
      - ./server/logs:/app/logs
      - ./audio-cache:/app/audio-cache
    ports:
      - "3000:3000"
    networks:
      - ai-dialer-network
    depends_on:
      - postgres
      - redis
      - asterisk

  # Frontend React App
  frontend:
    build:
      context: ./client
      dockerfile: Dockerfile
      args:
        REACT_APP_API_URL: http://${SERVER_IP}:3000
    container_name: ai-dialer-frontend
    restart: always
    ports:
      - "3001:80"
    networks:
      - ai-dialer-network
    depends_on:
      - backend

volumes:
  postgres_data:
  redis_data:

networks:
  ai-dialer-network:
    driver: bridge
```

Save the file (`Ctrl + X`, `Y`, `Enter`)

---

## Step 6: Configure Firewall (2 minutes)

```bash
# Allow necessary ports
sudo ufw allow 22/tcp      # SSH
sudo ufw allow 3000/tcp    # Backend API
sudo ufw allow 3001/tcp    # Frontend
sudo ufw allow 5060/udp    # SIP
sudo ufw allow 8088/tcp    # Asterisk ARI
sudo ufw allow 10000:10100/udp  # RTP media

# Enable firewall
sudo ufw --force enable

# Check status
sudo ufw status
```

---

## Step 7: Deploy! (5 minutes)

### Build and start all services:

```bash
cd /opt/ai-dialer

# Load environment variables
export $(cat .env.production | xargs)

# Build and start
docker-compose -f docker-compose.demo.yml up -d --build

# This will take 5-10 minutes on first run
```

### Monitor the build:

```bash
# Watch logs
docker-compose -f docker-compose.demo.yml logs -f

# Press Ctrl+C to stop watching (services keep running)
```

### Wait for all services to start:

```bash
# Check status (all should show "Up")
docker-compose -f docker-compose.demo.yml ps
```

---

## Step 8: Run Database Migrations

```bash
# Wait 30 seconds for backend to be ready, then:
docker exec -it ai-dialer-backend npm run migrate
```

**Expected output:**
```
✓ Running migrations...
✓ Migration completed successfully
```

---

## Step 9: Create Admin User

```bash
docker exec -it ai-dialer-backend node scripts/create-admin.js
```

Enter:
- **Email**: admin@demo.com
- **Password**: Admin123!
- **First Name**: Admin
- **Last Name**: User

---

## Step 10: Access Your Demo! 🎉

### Open in your browser:

```
Frontend: http://YOUR_SERVER_IP:3001
API:      http://YOUR_SERVER_IP:3000/health
```

**Example:**
```
http://159.65.123.45:3001
```

### Login:
- **Email**: admin@demo.com
- **Password**: Admin123!

---

## Quick Reference

### Useful Commands:

```bash
# View all logs
docker-compose -f docker-compose.demo.yml logs -f

# View specific service logs
docker logs -f ai-dialer-backend

# Restart a service
docker-compose -f docker-compose.demo.yml restart backend

# Stop all services
docker-compose -f docker-compose.demo.yml down

# Start all services
docker-compose -f docker-compose.demo.yml up -d

# Check service status
docker-compose -f docker-compose.demo.yml ps

# Access backend shell
docker exec -it ai-dialer-backend bash

# Access database
docker exec -it ai-dialer-postgres psql -U ai_dialer_user -d ai_dialer_prod

# Backup database
docker exec ai-dialer-postgres pg_dump -U ai_dialer_user ai_dialer_prod > backup.sql
```

### Check Health:

```bash
# Backend health
curl http://localhost:3000/health

# Database
docker exec ai-dialer-postgres pg_isready -U ai_dialer_user

# Redis
docker exec ai-dialer-redis redis-cli ping

# All containers
docker ps
```

---

## Troubleshooting

### Services won't start:

```bash
# Check logs
docker-compose -f docker-compose.demo.yml logs

# Check disk space
df -h

# Check memory
free -h

# Restart everything
docker-compose -f docker-compose.demo.yml down
docker-compose -f docker-compose.demo.yml up -d
```

### Can't access from browser:

```bash
# Verify services are running
docker ps

# Check if ports are open
sudo netstat -tulpn | grep -E '3000|3001'

# Check firewall
sudo ufw status

# Get your server IP
curl ifconfig.me
```

### Database connection errors:

```bash
# Check database logs
docker logs ai-dialer-postgres

# Verify password in .env.production matches
cat .env.production | grep POSTGRES_PASSWORD

# Restart database
docker-compose -f docker-compose.demo.yml restart postgres
```

### Frontend shows blank page:

```bash
# Rebuild frontend with correct API URL
docker-compose -f docker-compose.demo.yml build --no-cache frontend
docker-compose -f docker-compose.demo.yml up -d frontend
```

---

## Testing the System

### 1. Create a Campaign:
- Click "Campaigns" in sidebar
- Click "Create Campaign"
- Fill in details and save

### 2. Upload Contacts:
- Click "Contacts"
- Click "Upload Contacts"
- Upload a CSV file

### 3. Make a Test Call:
- Go to "Calls"
- Click on a contact
- Click "Call Now"

### 4. View Analytics:
- Click "Dashboard" or "Analytics"
- See call statistics

---

## Demo Cost Breakdown

| Item | Cost |
|------|------|
| **Server** (DigitalOcean) | $24-48/mo |
| **Telnyx Trial** | $10 credit (free) |
| **Telnyx Phone Number** | $2/mo |
| **Telnyx Calls** | $0.011/minute |
| **Total for demo** | ~$26-50/mo |

**💡 Tip**: You can delete the server after demo and only pay for hours used!

---

## When You're Ready for Production

1. **Get a domain name** (~$10-15/year)
2. **Setup SSL/HTTPS** (Let's Encrypt - free)
3. **Use production docker-compose**
4. **Enable backups**
5. **Setup monitoring**
6. **Configure proper security**

See `PRODUCTION_DEPLOYMENT_GUIDE.md` for full production setup.

---

## Need Help?

### Common Issues:

**"Connection refused"**
- Wait 2-3 minutes for services to fully start
- Check firewall allows ports 3000 and 3001

**"Database connection error"**
- Verify .env.production has correct credentials
- Restart postgres: `docker-compose -f docker-compose.demo.yml restart postgres`

**"Telnyx calls not working"**
- Verify API key is correct
- Check SIP credentials
- Ensure phone number is assigned

### Get Logs:

```bash
# All services
docker-compose -f docker-compose.demo.yml logs -f

# Just errors
docker-compose -f docker-compose.demo.yml logs | grep -i error
```

---

## Summary Checklist

Before accessing your demo:

- [ ] Server created and IP obtained
- [ ] Docker and Docker Compose installed
- [ ] Project files uploaded to `/opt/ai-dialer`
- [ ] `.env.production` configured with your IP and credentials
- [ ] Firewall configured (ports 3000, 3001 open)
- [ ] Docker containers running (`docker ps`)
- [ ] Database migrations completed
- [ ] Admin user created
- [ ] Can access `http://YOUR_IP:3001` in browser

---

**You're ready to demo! 🚀**

Access your system at: `http://YOUR_SERVER_IP:3001`
