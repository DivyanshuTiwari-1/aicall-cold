# AI Dialer Pro - Quick Start Guide

## 🚀 Deploy in 10 Minutes

### Prerequisites
- Ubuntu 22.04 LTS server (4GB+ RAM, 2+ CPU cores)
- Domain name pointed to your server IP
- Root or sudo access

### Step 1: Install Docker

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify
docker --version
docker-compose --version
```

### Step 2: Clone/Upload Project

```bash
# Create directory
sudo mkdir -p /opt/ai-dialer
cd /opt/ai-dialer

# Option A: Clone from git
git clone <your-repo> .

# Option B: Upload via SCP
# From your local machine:
# scp -r /path/to/aicall/* user@your-server:/opt/ai-dialer/
```

### Step 3: Configure Environment

```bash
cd /opt/ai-dialer

# Copy environment template
cp .env.example .env.production

# Edit configuration
nano .env.production
```

**Required Changes:**
```bash
# Change these!
DOMAIN=yourdomain.com
POSTGRES_PASSWORD=<strong-password>
JWT_SECRET=<generate-with: openssl rand -base64 64>
TELNYX_API_KEY=<from-telnyx-dashboard>
TELNYX_SIP_USERNAME=<from-telnyx>
TELNYX_SIP_PASSWORD=<from-telnyx>
TELNYX_DID=+1234567890
```

### Step 4: Run Deployment Script

```bash
# Make script executable
chmod +x deploy.sh

# Run deployment
sudo ./deploy.sh
```

The script will:
1. ✅ Check prerequisites
2. ✅ Create directories
3. ✅ Validate configuration
4. ✅ Setup SSL certificates
5. ✅ Build Docker images
6. ✅ Start all services
7. ✅ Run database migrations
8. ✅ Create admin user
9. ✅ Run health checks
10. ✅ Show access URLs

### Step 5: Access Your Application

```
Frontend: https://yourdomain.com
API:      https://api.yourdomain.com
```

**Default Login:**
- Email: admin@example.com
- Password: admin123
- **⚠️ Change immediately after first login!**

---

## 🔧 Manual Deployment (Without Script)

### 1. Start Services

```bash
# Build and start
docker-compose -f docker-compose.production.yml up -d --build

# Check status
docker-compose -f docker-compose.production.yml ps
```

### 2. Run Migrations

```bash
docker exec -it ai-dialer-backend npm run migrate
```

### 3. Create Admin User

```bash
docker exec -it ai-dialer-backend node scripts/create-admin.js
```

### 4. Setup SSL (Let's Encrypt)

```bash
# Request certificate
docker-compose -f docker-compose.production.yml run --rm certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email your-email@example.com \
  --agree-tos \
  -d yourdomain.com \
  -d www.yourdomain.com \
  -d api.yourdomain.com

# Restart nginx
docker-compose -f docker-compose.production.yml restart nginx
```

---

## 📋 Post-Deployment Tasks

### 1. Configure Firewall

```bash
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw allow 5060/udp  # SIP
sudo ufw enable
```

### 2. Setup Automated Backups

```bash
# Make backup script executable
chmod +x scripts/backup-db.sh

# Add to crontab (daily at 2 AM)
crontab -e

# Add this line:
0 2 * * * /opt/ai-dialer/scripts/backup-db.sh
```

### 3. Configure Health Monitoring

```bash
# Make health check executable
chmod +x scripts/health-check.sh

# Add to crontab (every 5 minutes)
*/5 * * * * /opt/ai-dialer/scripts/health-check.sh
```

### 4. Configure Telnyx

1. Go to Telnyx Mission Control
2. Navigate to **SIP Connections**
3. Add your server IP to IP ACL
4. Configure outbound settings
5. Assign phone number(s)

---

## 🔍 Verify Installation

### Check Services

```bash
# All services should be "Up"
docker-compose -f docker-compose.production.yml ps
```

### Test Backend API

```bash
curl http://localhost:3000/health

# Should return:
# {"status":"ok","timestamp":"..."}
```

### Test Database

```bash
docker exec -it ai-dialer-postgres psql -U ai_dialer_user -d ai_dialer_prod -c "SELECT NOW();"
```

### View Logs

```bash
# All logs
docker-compose -f docker-compose.production.yml logs -f

# Specific service
docker logs -f ai-dialer-backend
```

---

## 🛠️ Common Commands

```bash
# View all containers
docker ps

# Restart a service
docker-compose -f docker-compose.production.yml restart backend

# Stop all services
docker-compose -f docker-compose.production.yml down

# Start all services
docker-compose -f docker-compose.production.yml up -d

# View resource usage
docker stats

# Clean up unused resources
docker system prune -a
```

---

## 🚨 Troubleshooting

### Services won't start
```bash
# Check logs
docker-compose -f docker-compose.production.yml logs

# Check disk space
df -h

# Check memory
free -h
```

### Can't access website
```bash
# Check nginx logs
docker logs ai-dialer-nginx

# Verify domain DNS
nslookup yourdomain.com

# Check firewall
sudo ufw status
```

### Database errors
```bash
# Access database
docker exec -it ai-dialer-postgres psql -U ai_dialer_user -d ai_dialer_prod

# Run migrations again
docker exec -it ai-dialer-backend npm run migrate
```

### SSL certificate issues
```bash
# Check certificate
openssl x509 -in certbot/conf/live/yourdomain.com/fullchain.pem -text -noout

# Renew manually
docker-compose -f docker-compose.production.yml run --rm certbot renew
```

---

## 📚 Next Steps

1. **Security**: Change all default passwords
2. **Backups**: Verify automated backups are working
3. **Monitoring**: Setup email/Slack alerts
4. **Testing**: Make test calls to verify system
5. **Documentation**: Update production URLs in docs
6. **Training**: Train your team on the system

---

## 📞 Support

- **Full Documentation**: See `PRODUCTION_DEPLOYMENT_GUIDE.md`
- **API Docs**: https://api.yourdomain.com/docs
- **Issues**: Check logs first, then contact support

---

**You're all set!** 🎉

Your AI Dialer Pro is now running in production.
