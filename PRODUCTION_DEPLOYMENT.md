# 🚀 Production Deployment - Complete Guide

## ⚡ Quick Start (TL;DR)

```bash
# 1. Edit domain in deploy.sh (line 12)
DOMAIN="yourdomain.com"

# 2. Push to GitHub
git add deploy.sh
git commit -m "Configure domain"
git push origin main

# 3. On AWS server
ssh ubuntu@your-server-ip
git clone <your-repo> /opt/ai-dialer
cd /opt/ai-dialer
chmod +x deploy.sh
./deploy.sh

# That's it! ✅
```

---

## Table of Contents
1. [DNS Setup](#1-dns-setup)
2. [First Time Deployment](#2-first-time-deployment)
3. [Regular Updates (Daily Workflow)](#3-regular-updates-daily-workflow)
4. [Data Persistence](#4-data-persistence)
5. [Rollback & Recovery](#5-rollback--recovery)
6. [Monitoring & Maintenance](#6-monitoring--maintenance)
7. [Quick Command Reference](#7-quick-command-reference)
8. [Troubleshooting](#8-troubleshooting)

---

## 1. DNS Setup

### What You Need to Provide to Your DNS Administrator:

```
Get your AWS server IP:
curl -4 ifconfig.me
```

**DNS Records Required:**

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | @ | YOUR_AWS_IP | 3600 |
| A | www | YOUR_AWS_IP | 3600 |
| A | api | YOUR_AWS_IP | 3600 |

**Example:**
```
A    @      3.15.123.45    3600
A    www    3.15.123.45    3600
A    api    3.15.123.45    3600
```

**What This Does:**
- `yourdomain.com` → Points to your AWS server
- `www.yourdomain.com` → Points to your AWS server
- `api.yourdomain.com` → Points to your AWS server (backend API)

**Wait Time:** 15-30 minutes for DNS propagation

**Verify DNS:**
```bash
nslookup yourdomain.com
nslookup api.yourdomain.com
```

---

## 2. First Time Deployment

### Step 1: Configure Domain (Local Machine)

```bash
# Edit deploy.sh line 12
nano deploy.sh

# Change this line:
DOMAIN="yourdomain.com"  # ⚠️ CHANGE TO YOUR ACTUAL DOMAIN

# Save and push to GitHub
git add deploy.sh
git commit -m "Configure production domain"
git push origin main
```

### Step 2: Prepare AWS Server

```bash
# SSH to your AWS server
ssh ubuntu@your-aws-ip

# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker (if not already installed)
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Install Certbot (for SSL)
sudo apt install -y certbot

# Clone your repository
sudo mkdir -p /opt/ai-dialer
cd /opt/ai-dialer
git clone <your-repo-url> .
```

### Step 3: Deploy! 🚀

```bash
# Make script executable
chmod +x deploy.sh

# Run deployment (handles everything automatically!)
./deploy.sh
```

**The script will automatically:**
- ✅ Generate secure passwords
- ✅ Create all configuration files
- ✅ Setup SSL certificates (Let's Encrypt or self-signed)
- ✅ Clean up old containers/images (preserves data!)
- ✅ Build and start all services
- ✅ Run database migrations
- ✅ Create admin user
- ✅ Configure firewall
- ✅ Run health checks

### Step 4: Verify Deployment

```bash
# Check services
docker-compose -f docker-compose.demo.yml ps

# Test API
curl https://api.yourdomain.com/health

# Test frontend
curl https://yourdomain.com

# View logs
docker-compose -f docker-compose.demo.yml logs -f
```

### Step 5: Login & Test

Open browser: `https://yourdomain.com`

**Default Login:**
- Email: `admin@yourdomain.com`
- Password: `Admin123!`

(Change password immediately after first login!)

---

## 3. Regular Updates (Daily Workflow)

### ⚡ Simple Update Process

**Every time you make code changes:**

```bash
# 1. On your development machine
git add .
git commit -m "Your changes"
git push origin main

# 2. On AWS production server
ssh ubuntu@your-aws-ip
cd /opt/ai-dialer
git pull origin main
./deploy.sh

# That's it! ✅ Data is preserved, only code updates!
```

### What the Update Script Does:

1. ✅ Loads production environment
2. ✅ Pulls latest code from Git
3. ✅ Creates automatic database backup
4. ✅ Rebuilds containers with new code
5. ✅ Gracefully restarts services
6. ✅ Keeps ALL user data intact
7. ✅ Runs database migrations
8. ✅ Verifies services are healthy

### Update Specific Service Only

```bash
# Only backend
docker-compose -f docker-compose.demo.yml build backend
docker-compose -f docker-compose.demo.yml up -d backend

# Only frontend
docker-compose -f docker-compose.demo.yml build frontend
docker-compose -f docker-compose.demo.yml up -d frontend
```

---

## 4. Data Persistence

### ✅ What's ALWAYS Protected (Never Lost)

These volumes persist across all updates, rebuilds, and restarts:

```yaml
postgres_data:        # All database data
  - Users, campaigns, contacts, calls
  - Campaign settings, scripts
  - Call history, analytics

redis_data:           # Cache and sessions
  - User sessions
  - API cache
  - Real-time data

asterisk_sounds:      # Audio files
  - Call recordings
  - TTS cache

./server/uploads:     # User uploads
  - Contact CSV files
  - Imported data

./server/logs:        # Application logs
  - Error logs
  - Access logs

./audio-cache:        # TTS audio cache
  - Generated audio files

./ssl:                # SSL certificates
  - HTTPS certificates
```

### 🔄 What Gets Updated

```
Application code      → Rebuilt each update
Dependencies          → Rebuilt each update
Container images      → Rebuilt each update
Configuration files   → Updated from Git
```

### How It Works

```
┌──────────────────────────────┐
│  Update Script Runs          │
└──────────┬───────────────────┘
           │
           ↓
┌──────────────────────────────┐
│  1. Backup Database          │
│  2. Build new containers     │
│  3. Stop old containers      │
│  4. Start new containers     │
└──────────┬───────────────────┘
           │
           ↓
┌──────────────────────────────┐
│  New Containers Mount        │
│  SAME Volumes                │
│  → All data still there! ✅  │
└──────────────────────────────┘
```

### Safe Commands (No Data Loss)

```bash
✅ ./update-production.sh
✅ docker-compose restart
✅ docker-compose down
✅ docker-compose up -d --build
✅ docker-compose up -d --force-recreate
```

### ❌ DANGEROUS Commands (NEVER USE)

```bash
❌ docker-compose down --volumes        # DELETES ALL DATA!
❌ docker volume rm postgres_data       # DELETES DATABASE!
❌ rm -rf server/uploads/               # DELETES UPLOADS!
❌ docker system prune --volumes        # DELETES VOLUMES!
```

---

## 5. Rollback & Recovery

### Quick Rollback

```bash
# If update causes issues, rollback immediately
./rollback-production.sh
```

This will:
1. Show recent Git commits
2. Let you choose which version to restore
3. Optionally restore database backup
4. Rebuild and restart services

### Manual Rollback

```bash
# View recent commits
git log --oneline -10

# Rollback to specific commit
git checkout <commit-hash>

# Rebuild and restart
docker-compose -f docker-compose.demo.yml down
docker-compose -f docker-compose.demo.yml up -d --build
```

### Database Restore

```bash
# List available backups
ls -lh backups/

# Restore specific backup
gunzip < backups/pre_update_20241024_120000.sql.gz | \
  docker exec -i ai-dialer-postgres psql -U ai_dialer_user ai_dialer_prod
```

### Manual Backup

```bash
# Create manual backup before major changes
docker exec ai-dialer-postgres pg_dump -U ai_dialer_user ai_dialer_prod | \
  gzip > backups/manual_$(date +%Y%m%d_%H%M%S).sql.gz
```

---

## 6. Monitoring & Maintenance

### Check Service Status

```bash
# All services
docker-compose -f docker-compose.demo.yml ps

# Detailed status
docker stats

# Service health
curl http://localhost:3000/health
```

### View Logs

```bash
# All services (live)
docker-compose -f docker-compose.demo.yml logs -f

# Specific service
docker logs ai-dialer-backend -f
docker logs ai-dialer-frontend -f
docker logs ai-dialer-postgres -f

# Last 100 lines
docker logs ai-dialer-backend --tail 100

# Search for errors
docker logs ai-dialer-backend --tail 500 | grep -i error
```

### Resource Monitoring

```bash
# Container resources
docker stats

# Disk usage
df -h

# Docker disk usage
docker system df

# Database size
docker exec ai-dialer-postgres psql -U ai_dialer_user -d ai_dialer_prod -c \
  "SELECT pg_size_pretty(pg_database_size('ai_dialer_prod'));"
```

### Automated Backups

Create `/opt/ai-dialer/backup-daily.sh`:

```bash
#!/bin/bash
BACKUP_DIR="/opt/ai-dialer/backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup database
docker exec ai-dialer-postgres pg_dump -U ai_dialer_user ai_dialer_prod | \
  gzip > $BACKUP_DIR/db_backup_$DATE.sql.gz

# Keep only last 30 days
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete

echo "Backup completed: $DATE"
```

**Setup cron job:**
```bash
chmod +x /opt/ai-dialer/backup-daily.sh

# Edit crontab
crontab -e

# Add this line (daily at 2 AM)
0 2 * * * /opt/ai-dialer/backup-daily.sh >> /var/log/ai-dialer-backup.log 2>&1
```

### Renew SSL Certificate

```bash
# Auto-renew (runs automatically)
sudo certbot renew

# Force renewal
sudo certbot renew --force-renewal

# Copy renewed certs
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem ./ssl/nginx-selfsigned.crt
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem ./ssl/nginx-selfsigned.key

# Restart frontend
docker-compose -f docker-compose.demo.yml restart frontend
```

### Weekly Maintenance

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Clean Docker resources
docker system prune -f

# Clean old logs
find server/logs -name "*.log" -mtime +7 -delete

# Check disk space
df -h
```

---

## 7. Quick Command Reference

### Service Management

```bash
# Start all services
docker-compose -f docker-compose.demo.yml up -d

# Stop all services
docker-compose -f docker-compose.demo.yml down

# Restart all services
docker-compose -f docker-compose.demo.yml restart

# Restart specific service
docker-compose -f docker-compose.demo.yml restart backend
docker-compose -f docker-compose.demo.yml restart frontend
docker-compose -f docker-compose.demo.yml restart postgres
```

### Logs & Debugging

```bash
# Live logs (all services)
docker-compose -f docker-compose.demo.yml logs -f

# Backend logs
docker logs ai-dialer-backend -f

# Last 100 lines
docker logs ai-dialer-backend --tail 100

# Search for errors
docker logs ai-dialer-backend 2>&1 | grep -i error
```

### Database Access

```bash
# Connect to database
docker exec -it ai-dialer-postgres psql -U ai_dialer_user -d ai_dialer_prod

# Run SQL query
docker exec ai-dialer-postgres psql -U ai_dialer_user -d ai_dialer_prod -c "SELECT COUNT(*) FROM users;"

# Backup database
docker exec ai-dialer-postgres pg_dump -U ai_dialer_user ai_dialer_prod | \
  gzip > backup_$(date +%Y%m%d).sql.gz

# Restore database
gunzip < backup_20241024.sql.gz | \
  docker exec -i ai-dialer-postgres psql -U ai_dialer_user ai_dialer_prod
```

### Health Checks

```bash
# Backend health
curl http://localhost:3000/health

# Frontend health
curl http://localhost:3001

# Database health
docker exec ai-dialer-postgres pg_isready -U ai_dialer_user

# Redis health
docker exec ai-dialer-redis redis-cli ping
```

### Container Shell Access

```bash
# Backend shell
docker exec -it ai-dialer-backend bash

# Database shell
docker exec -it ai-dialer-postgres bash

# Run Node command in backend
docker exec ai-dialer-backend node scripts/your-script.js
```

---

## 8. Troubleshooting

### Issue: Service Won't Start

```bash
# Check logs
docker logs ai-dialer-backend --tail 100

# Check if port is in use
sudo netstat -tulpn | grep 3000

# Check service status
docker-compose -f docker-compose.demo.yml ps

# Restart service
docker-compose -f docker-compose.demo.yml restart backend
```

### Issue: Database Connection Error

```bash
# Check database status
docker exec ai-dialer-postgres pg_isready -U ai_dialer_user

# Check database logs
docker logs ai-dialer-postgres --tail 100

# Restart database
docker-compose -f docker-compose.demo.yml restart postgres

# Verify credentials in .env.production
cat .env.production | grep POSTGRES
```

### Issue: Out of Disk Space

```bash
# Check disk usage
df -h

# Clean Docker resources
docker system prune -a -f

# Clean old logs
find server/logs -name "*.log" -mtime +7 -delete

# Clean old backups
find backups -name "*.sql.gz" -mtime +30 -delete

# Check Docker disk usage
docker system df
```

### Issue: Users See Old Version

```bash
# Clear Redis cache
docker exec ai-dialer-redis redis-cli FLUSHALL

# Rebuild frontend
docker-compose -f docker-compose.demo.yml build --no-cache frontend
docker-compose -f docker-compose.demo.yml up -d frontend

# Tell users to hard refresh browser
# Ctrl+Shift+R (Windows/Linux)
# Cmd+Shift+R (Mac)
```

### Issue: SSL Certificate Expired

```bash
# Check certificate expiry
openssl x509 -in ssl/nginx-selfsigned.crt -text -noout | grep "Not After"

# Renew certificate
sudo certbot renew --force-renewal

# Copy renewed certificates
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem ./ssl/nginx-selfsigned.crt
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem ./ssl/nginx-selfsigned.key

# Restart frontend
docker-compose -f docker-compose.demo.yml restart frontend
```

### Issue: High Memory Usage

```bash
# Check resource usage
docker stats

# Restart services to free memory
docker-compose -f docker-compose.demo.yml restart

# If persistent, upgrade AWS instance
# Go to AWS Console → EC2 → Stop Instance → Change Instance Type → Start
```

### Issue: Can't Access from Domain

```bash
# Check DNS
nslookup yourdomain.com
nslookup api.yourdomain.com

# Check if services are running
docker-compose -f docker-compose.demo.yml ps

# Check AWS Security Group
# Ensure ports 80, 443, 3000, 3001 are open

# Check nginx logs
docker logs ai-dialer-frontend --tail 100

# Test locally first
curl http://localhost:3001
curl http://localhost:3000/health
```

---

## 🎯 Production Checklist

### Initial Setup ✅
- [ ] DNS records configured
- [ ] SSL certificate installed
- [ ] `.env.production` configured
- [ ] Firewall rules configured
- [ ] First deployment successful
- [ ] Admin user created
- [ ] Test call successful
- [ ] Automated backups setup

### After Each Update ✅
- [ ] Git changes pulled
- [ ] Update script completed successfully
- [ ] All services running
- [ ] No errors in logs
- [ ] Website accessible
- [ ] Can login
- [ ] Test critical features
- [ ] Backup created automatically

### Weekly Maintenance ✅
- [ ] Check logs for errors
- [ ] Monitor disk space
- [ ] Review backups
- [ ] Update system packages
- [ ] Clean Docker resources

---

## 📞 Important Ports (AWS Security Group)

Ensure these ports are open in your AWS Security Group:

```
Port        Protocol    Purpose
────────────────────────────────────────
22          TCP         SSH access
80          TCP         HTTP (redirects to HTTPS)
443         TCP         HTTPS
3000        TCP         Backend API
3001        TCP         Frontend
5060        UDP         SIP signaling
8088        TCP         Asterisk ARI
10000-      UDP         RTP media streams
10100
```

---

## 🎉 Summary

### Daily Workflow:
```bash
# Make changes → Commit → Push
git commit -am "Your changes"
git push origin main

# Update production
ssh ubuntu@your-aws-ip
cd /opt/ai-dialer
./update-production.sh
```

### Key Points:
- ✅ User data **ALWAYS preserved**
- ✅ Automatic backups before each update
- ✅ Easy rollback if issues
- ✅ Zero downtime on small updates
- ✅ Simple one-command deployment

### Important Files:
```
.env.production          → Configuration (KEEP SECURE!)
update-production.sh     → Regular updates
rollback-production.sh   → Emergency rollback
backups/                 → Database backups
```

**You're ready for production!** 🚀

For any issues, check logs first:
```bash
docker-compose -f docker-compose.demo.yml logs -f
```
