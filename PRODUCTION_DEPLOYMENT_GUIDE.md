# AI Dialer Pro - Production Deployment Guide

## Table of Contents
1. [System Requirements](#system-requirements)
2. [Infrastructure Setup](#infrastructure-setup)
3. [Pre-Deployment Checklist](#pre-deployment-checklist)
4. [Deployment Methods](#deployment-methods)
5. [Environment Configuration](#environment-configuration)
6. [Database Setup](#database-setup)
7. [SSL/TLS Configuration](#ssltls-configuration)
8. [Monitoring & Logging](#monitoring--logging)
9. [Backup & Recovery](#backup--recovery)
10. [Security Best Practices](#security-best-practices)
11. [Scaling Considerations](#scaling-considerations)
12. [Troubleshooting](#troubleshooting)

---

## System Requirements

### Minimum Production Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| **CPU** | 4 cores | 8 cores |
| **RAM** | 8 GB | 16 GB |
| **Storage** | 100 GB SSD | 250 GB SSD |
| **Network** | 100 Mbps | 1 Gbps |
| **OS** | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |

### Software Requirements

- Docker 24.0+ and Docker Compose 2.0+
- PostgreSQL 15+
- Redis 7+
- Asterisk 20+ with ARI support
- Node.js 18+ LTS
- Nginx (reverse proxy)
- SSL Certificate (Let's Encrypt recommended)

---

## Infrastructure Setup

### Option A: Single Server Deployment (Small to Medium)

**Suitable for:** Up to 10,000 contacts, 50 concurrent calls

```
┌─────────────────────────────────────────────┐
│           Production Server                  │
│  ┌────────────────────────────────────────┐ │
│  │  Nginx (SSL Termination)               │ │
│  │  Port 80/443                           │ │
│  └────────────────────────────────────────┘ │
│              ↓                               │
│  ┌──────────┬──────────┬──────────────────┐ │
│  │ Frontend │ Backend  │ Asterisk         │ │
│  │ (React)  │ (Node)   │ (VoIP)          │ │
│  │ Port     │ Port     │ Port 8088/5060  │ │
│  │ 3001     │ 3000     │                 │ │
│  └──────────┴──────────┴──────────────────┘ │
│              ↓                               │
│  ┌──────────────────┬───────────────────┐   │
│  │  PostgreSQL      │  Redis            │   │
│  │  Port 5432       │  Port 6379        │   │
│  └──────────────────┴───────────────────┘   │
└─────────────────────────────────────────────┘
```

### Option B: Multi-Server Deployment (Large Scale)

**Suitable for:** 100,000+ contacts, 500+ concurrent calls

```
┌──────────────┐
│ Load Balancer│
│   (Nginx)    │
└──────┬───────┘
       │
       ├─────────┬─────────┬─────────┐
       ↓         ↓         ↓         ↓
┌──────────┐ ┌──────────┐ ┌──────────┐
│ App      │ │ App      │ │ App      │
│ Server 1 │ │ Server 2 │ │ Server 3 │
└──────────┘ └──────────┘ └──────────┘
       │         │         │
       └─────────┴─────────┘
              ↓
┌──────────────────────────┐
│  Database Cluster        │
│  (PostgreSQL Master/     │
│   Replica)               │
└──────────────────────────┘
       │
       ↓
┌──────────────────────────┐
│  Asterisk Cluster        │
│  (Multiple Servers)      │
└──────────────────────────┘
```

---

## Pre-Deployment Checklist

### 1. Domain & DNS Setup

- [ ] Purchase domain name (e.g., `yourdomain.com`)
- [ ] Configure DNS records:
  ```
  A     @              YOUR_SERVER_IP
  A     www            YOUR_SERVER_IP
  A     api            YOUR_SERVER_IP
  A     asterisk       YOUR_SERVER_IP (optional)
  ```

### 2. Server Preparation

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install essential packages
sudo apt install -y curl git wget vim ufw fail2ban

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify installations
docker --version
docker-compose --version
```

### 3. Firewall Configuration

```bash
# Configure UFW
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw allow 5060/udp  # SIP
sudo ufw allow 10000:20000/udp  # RTP (adjust as needed)
sudo ufw enable

# Verify
sudo ufw status
```

---

## Deployment Methods

### Method 1: Docker Deployment (Recommended)

#### Step 1: Clone Repository

```bash
# Create application directory
sudo mkdir -p /opt/ai-dialer
cd /opt/ai-dialer

# Clone repository
git clone <your-repo-url> .

# Or upload files via SCP/SFTP
```

#### Step 2: Create Production Environment File

```bash
# Create .env.production
cat > .env.production << 'EOF'
# Application
NODE_ENV=production
PORT=3000
FRONTEND_PORT=3001

# Domain Configuration
DOMAIN=yourdomain.com
API_URL=https://api.yourdomain.com
CLIENT_URL=https://yourdomain.com

# Database
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=ai_dialer_prod
POSTGRES_USER=ai_dialer_user
POSTGRES_PASSWORD=CHANGE_THIS_SECURE_PASSWORD_123!

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=CHANGE_THIS_REDIS_PASSWORD_456!

# JWT & Security
JWT_SECRET=CHANGE_THIS_TO_A_VERY_LONG_RANDOM_STRING_789!
JWT_EXPIRES_IN=7d
SESSION_SECRET=CHANGE_THIS_SESSION_SECRET_012!

# Telnyx Configuration
TELNYX_API_KEY=your_telnyx_api_key_here
TELNYX_SIP_USERNAME=your_telnyx_sip_username
TELNYX_SIP_PASSWORD=your_telnyx_sip_password
TELNYX_DOMAIN=sip.telnyx.com
TELNYX_DID=+1234567890
TELNYX_PHONE_NUMBER=+1234567890
TELNYX_CALLER_ID=+1234567890

# Asterisk ARI
ARI_URL=http://asterisk:8088/ari
ARI_USERNAME=ai-dialer
ARI_PASSWORD=CHANGE_THIS_ARI_PASSWORD_345!

# Email (Optional - for notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=noreply@yourdomain.com

# Monitoring
LOG_LEVEL=info
ENABLE_METRICS=true

# Call Queue Settings
MAX_CONCURRENT_CALLS=10
CALL_INTERVAL_MS=30000
MAX_RETRY_ATTEMPTS=3
RETRY_DELAY_MS=300000

# File Upload
MAX_FILE_SIZE=10485760
UPLOAD_DIR=/app/uploads

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
EOF

# Secure the file
chmod 600 .env.production
```

#### Step 3: Create Production Docker Compose

```bash
cat > docker-compose.production.yml << 'EOF'
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
      - ./backups:/backups
    ports:
      - "127.0.0.1:5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5
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
    healthcheck:
      test: ["CMD", "redis-cli", "--raw", "incr", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - ai-dialer-network

  # Asterisk VoIP Server
  asterisk:
    build:
      context: ./asterisk
      dockerfile: Dockerfile.production
    container_name: ai-dialer-asterisk
    restart: always
    environment:
      ARI_USERNAME: ${ARI_USERNAME}
      ARI_PASSWORD: ${ARI_PASSWORD}
    volumes:
      - ./asterisk-config:/etc/asterisk
      - ./asterisk-logs:/var/log/asterisk
      - asterisk_sounds:/var/lib/asterisk/sounds
    ports:
      - "8088:8088"  # ARI
      - "5060:5060/udp"  # SIP
      - "10000-10100:10000-10100/udp"  # RTP
    networks:
      - ai-dialer-network
    depends_on:
      - postgres
      - redis

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
      - "127.0.0.1:3000:3000"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    networks:
      - ai-dialer-network
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      asterisk:
        condition: service_started

  # Frontend React App
  frontend:
    build:
      context: ./client
      dockerfile: Dockerfile
      args:
        REACT_APP_API_URL: ${API_URL}
    container_name: ai-dialer-frontend
    restart: always
    ports:
      - "127.0.0.1:3001:80"
    networks:
      - ai-dialer-network
    depends_on:
      - backend

  # Nginx Reverse Proxy
  nginx:
    image: nginx:alpine
    container_name: ai-dialer-nginx
    restart: always
    volumes:
      - ./nginx/nginx.production.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
      - ./certbot/conf:/etc/letsencrypt:ro
      - ./certbot/www:/var/www/certbot:ro
    ports:
      - "80:80"
      - "443:443"
    networks:
      - ai-dialer-network
    depends_on:
      - backend
      - frontend

  # Certbot for SSL
  certbot:
    image: certbot/certbot
    container_name: ai-dialer-certbot
    volumes:
      - ./certbot/conf:/etc/letsencrypt
      - ./certbot/www:/var/www/certbot
    entrypoint: "/bin/sh -c 'trap exit TERM; while :; do certbot renew; sleep 12h & wait $${!}; done;'"
    networks:
      - ai-dialer-network

volumes:
  postgres_data:
    driver: local
  redis_data:
    driver: local
  asterisk_sounds:
    driver: local

networks:
  ai-dialer-network:
    driver: bridge
EOF
```

#### Step 4: Create Production Nginx Configuration

```bash
mkdir -p nginx
cat > nginx/nginx.production.conf << 'EOF'
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 4096;
    use epoll;
    multi_accept on;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;

    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    client_max_body_size 50M;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript
               application/json application/javascript application/xml+rss
               application/rss+xml font/truetype font/opentype
               application/vnd.ms-fontobject image/svg+xml;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=login_limit:10m rate=5r/m;

    # Upstream backends
    upstream backend {
        least_conn;
        server backend:3000 max_fails=3 fail_timeout=30s;
        keepalive 32;
    }

    upstream frontend {
        least_conn;
        server frontend:80 max_fails=3 fail_timeout=30s;
        keepalive 32;
    }

    # HTTP to HTTPS redirect
    server {
        listen 80;
        server_name yourdomain.com www.yourdomain.com api.yourdomain.com;

        # Let's Encrypt challenge
        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }

        location / {
            return 301 https://$host$request_uri;
        }
    }

    # Main HTTPS server - Frontend
    server {
        listen 443 ssl http2;
        server_name yourdomain.com www.yourdomain.com;

        ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;
        ssl_prefer_server_ciphers on;
        ssl_session_cache shared:SSL:10m;
        ssl_session_timeout 10m;

        # Security headers
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header Referrer-Policy "no-referrer-when-downgrade" always;

        location / {
            proxy_pass http://frontend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
        }
    }

    # API Server
    server {
        listen 443 ssl http2;
        server_name api.yourdomain.com;

        ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;
        ssl_prefer_server_ciphers on;

        # Security headers
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;

        # Rate limiting for API
        location /api/v1/auth/login {
            limit_req zone=login_limit burst=5 nodelay;
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        location /api {
            limit_req zone=api_limit burst=20 nodelay;
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
            proxy_read_timeout 300s;
            proxy_connect_timeout 75s;
        }

        # WebSocket support
        location /socket.io {
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_read_timeout 86400;
        }

        # Health check
        location /health {
            proxy_pass http://backend;
            access_log off;
        }
    }
}
EOF
```

#### Step 5: Setup SSL Certificate

```bash
# Create directories
mkdir -p certbot/conf certbot/www

# Initial certificate request (HTTP-01 challenge)
docker-compose -f docker-compose.production.yml run --rm certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email your-email@example.com \
  --agree-tos \
  --no-eff-email \
  -d yourdomain.com \
  -d www.yourdomain.com \
  -d api.yourdomain.com

# Or use DNS challenge (recommended for wildcard)
docker-compose -f docker-compose.production.yml run --rm certbot certonly \
  --manual \
  --preferred-challenges dns \
  --email your-email@example.com \
  --agree-tos \
  -d yourdomain.com \
  -d *.yourdomain.com
```

#### Step 6: Deploy the Application

```bash
# Build and start all services
docker-compose -f docker-compose.production.yml up -d --build

# Check status
docker-compose -f docker-compose.production.yml ps

# View logs
docker-compose -f docker-compose.production.yml logs -f

# Check individual service
docker-compose -f docker-compose.production.yml logs backend
```

#### Step 7: Run Database Migrations

```bash
# Access backend container
docker exec -it ai-dialer-backend bash

# Run migrations
npm run migrate

# Create initial admin user (if needed)
node scripts/create-admin.js

# Exit container
exit
```

---

## Environment Configuration

### Critical Environment Variables

#### Required for Production

```bash
# Database
POSTGRES_PASSWORD=       # Use strong password (20+ chars)
REDIS_PASSWORD=          # Use strong password (20+ chars)

# Security
JWT_SECRET=              # Generate: openssl rand -base64 64
SESSION_SECRET=          # Generate: openssl rand -base64 32

# Telnyx (Get from Telnyx Portal)
TELNYX_API_KEY=         # Mission Control → API Keys
TELNYX_SIP_USERNAME=    # SIP Connection credentials
TELNYX_SIP_PASSWORD=    # SIP Connection credentials
TELNYX_DID=             # Your Telnyx phone number

# Domain
DOMAIN=yourdomain.com
API_URL=https://api.yourdomain.com
CLIENT_URL=https://yourdomain.com
```

### Generate Strong Secrets

```bash
# JWT Secret
openssl rand -base64 64

# Session Secret
openssl rand -base64 32

# Redis Password
openssl rand -base64 32

# Database Password
openssl rand -base64 32 | tr -d "=+/" | cut -c1-25
```

---

## Database Setup

### Initial Setup

```bash
# Create backup script
cat > /opt/ai-dialer/scripts/backup-db.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/ai-dialer/backups"
DATE=$(date +%Y%m%d_%H%M%S)
CONTAINER="ai-dialer-postgres"

mkdir -p $BACKUP_DIR

docker exec $CONTAINER pg_dump -U ai_dialer_user ai_dialer_prod | \
  gzip > $BACKUP_DIR/backup_$DATE.sql.gz

# Keep only last 30 days
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +30 -delete

echo "Backup completed: backup_$DATE.sql.gz"
EOF

chmod +x /opt/ai-dialer/scripts/backup-db.sh
```

### Automated Backups

```bash
# Add to crontab
crontab -e

# Add this line (daily backup at 2 AM)
0 2 * * * /opt/ai-dialer/scripts/backup-db.sh >> /var/log/ai-dialer-backup.log 2>&1
```

### Database Restore

```bash
# Restore from backup
gunzip < backups/backup_20241023_020000.sql.gz | \
  docker exec -i ai-dialer-postgres psql -U ai_dialer_user ai_dialer_prod
```

---

## Monitoring & Logging

### Setup Logging

```bash
# Install log rotation
cat > /etc/logrotate.d/ai-dialer << 'EOF'
/opt/ai-dialer/server/logs/*.log {
    daily
    rotate 30
    compress
    delaycompress
    notifempty
    missingok
    sharedscripts
    postrotate
        docker exec ai-dialer-backend kill -USR1 1
    endscript
}
EOF
```

### Application Monitoring

```bash
# Create monitoring script
cat > /opt/ai-dialer/scripts/health-check.sh << 'EOF'
#!/bin/bash

# Check backend health
if ! curl -f http://localhost:3000/health > /dev/null 2>&1; then
    echo "Backend unhealthy - restarting"
    docker restart ai-dialer-backend
fi

# Check database
if ! docker exec ai-dialer-postgres pg_isready -U ai_dialer_user > /dev/null 2>&1; then
    echo "Database unhealthy - alert!"
    # Send alert notification
fi

# Check disk space
DISK_USAGE=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 85 ]; then
    echo "Disk usage critical: ${DISK_USAGE}%"
    # Send alert notification
fi
EOF

chmod +x /opt/ai-dialer/scripts/health-check.sh

# Add to crontab (every 5 minutes)
*/5 * * * * /opt/ai-dialer/scripts/health-check.sh >> /var/log/ai-dialer-health.log 2>&1
```

### View Logs

```bash
# All services
docker-compose -f docker-compose.production.yml logs -f

# Specific service
docker logs -f ai-dialer-backend
docker logs -f ai-dialer-asterisk

# Application logs
tail -f server/logs/app.log
tail -f server/logs/error.log

# Nginx logs
docker logs -f ai-dialer-nginx
```

---

## Security Best Practices

### 1. System Security

```bash
# Install fail2ban for brute force protection
sudo apt install fail2ban

# Configure fail2ban
sudo cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true

[nginx-limit-req]
enabled = true
filter = nginx-limit-req
logpath = /var/log/nginx/error.log
EOF

sudo systemctl enable fail2ban
sudo systemctl restart fail2ban
```

### 2. Database Security

```bash
# Ensure PostgreSQL only listens on localhost
# In docker-compose.production.yml, use:
ports:
  - "127.0.0.1:5432:5432"  # Not exposed to internet
```

### 3. Application Security Checklist

- [ ] Change all default passwords
- [ ] Use strong JWT secrets (64+ characters)
- [ ] Enable HTTPS only (no HTTP in production)
- [ ] Configure CORS properly
- [ ] Set rate limiting on all APIs
- [ ] Enable fail2ban for SSH
- [ ] Regular security updates
- [ ] Implement API authentication on all endpoints
- [ ] Use environment variables for secrets (never commit)
- [ ] Set up database backups
- [ ] Configure firewall rules
- [ ] Enable audit logging
- [ ] Implement session timeout

### 4. Telnyx Security

```bash
# Restrict SIP connections to your server IP in Telnyx portal:
# 1. Go to Telnyx Mission Control
# 2. Navigate to SIP Connections
# 3. Add IP ACL with your server's public IP
# 4. Enable authentication
```

---

## Scaling Considerations

### Horizontal Scaling (Multiple Servers)

#### Load Balancer Configuration

```nginx
upstream backend_cluster {
    least_conn;
    server backend1.internal:3000 max_fails=3 fail_timeout=30s;
    server backend2.internal:3000 max_fails=3 fail_timeout=30s;
    server backend3.internal:3000 max_fails=3 fail_timeout=30s;
}
```

#### Database Scaling

```bash
# Primary-Replica Setup for PostgreSQL
# Use pg_pool or pgbouncer for connection pooling

# Example: Install pgbouncer
docker run -d \
  --name pgbouncer \
  -e DATABASES_HOST=postgres-primary \
  -e DATABASES_PORT=5432 \
  -e DATABASES_NAME=ai_dialer_prod \
  -e DATABASES_USER=ai_dialer_user \
  -e DATABASES_PASSWORD=your_password \
  -e POOL_MODE=transaction \
  -e MAX_CLIENT_CONN=1000 \
  -e DEFAULT_POOL_SIZE=25 \
  pgbouncer/pgbouncer
```

### Performance Optimization

```bash
# Increase worker processes in backend
# In server/index.js or use PM2:

npm install -g pm2

pm2 start server/index.js -i max --name ai-dialer-backend

pm2 save
pm2 startup
```

---

## Maintenance

### Regular Maintenance Tasks

```bash
# Weekly tasks
# 1. Check disk space
df -h

# 2. Clean Docker resources
docker system prune -a --volumes -f

# 3. Check for updates
docker-compose -f docker-compose.production.yml pull

# 4. Restart services
docker-compose -f docker-compose.production.yml restart

# 5. Verify backups
ls -lh /opt/ai-dialer/backups/
```

### Update Deployment

```bash
# Pull latest changes
cd /opt/ai-dialer
git pull origin main

# Rebuild and restart
docker-compose -f docker-compose.production.yml down
docker-compose -f docker-compose.production.yml up -d --build

# Run migrations if needed
docker exec -it ai-dialer-backend npm run migrate

# Check logs
docker-compose -f docker-compose.production.yml logs -f
```

---

## Quick Start Commands

```bash
# Start all services
docker-compose -f docker-compose.production.yml up -d

# Stop all services
docker-compose -f docker-compose.production.yml down

# Restart specific service
docker-compose -f docker-compose.production.yml restart backend

# View logs
docker-compose -f docker-compose.production.yml logs -f backend

# Access backend shell
docker exec -it ai-dialer-backend bash

# Access database
docker exec -it ai-dialer-postgres psql -U ai_dialer_user -d ai_dialer_prod

# Backup database
docker exec ai-dialer-postgres pg_dump -U ai_dialer_user ai_dialer_prod > backup.sql

# Check service health
curl http://localhost:3000/health
```

---

## Troubleshooting

### Common Issues

#### 1. Services won't start
```bash
# Check logs
docker-compose -f docker-compose.production.yml logs

# Check disk space
df -h

# Check ports
sudo netstat -tulpn | grep LISTEN
```

#### 2. Database connection errors
```bash
# Verify database is running
docker ps | grep postgres

# Test connection
docker exec -it ai-dialer-postgres psql -U ai_dialer_user -d ai_dialer_prod

# Check credentials in .env.production
```

#### 3. SSL certificate issues
```bash
# Renew certificate manually
docker-compose -f docker-compose.production.yml run --rm certbot renew

# Check certificate expiry
openssl x509 -in certbot/conf/live/yourdomain.com/fullchain.pem -text -noout | grep "Not After"
```

#### 4. Asterisk connection issues
```bash
# Check Asterisk logs
docker logs ai-dialer-asterisk

# Test ARI connection
curl http://localhost:8088/ari/asterisk/info \
  -u ai-dialer:your_ari_password
```

#### 5. High CPU/Memory usage
```bash
# Check resource usage
docker stats

# Increase resources if needed
# Edit docker-compose.production.yml:
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 4G
```

---

## Support & Resources

### Documentation
- Asterisk: https://www.asterisk.org/
- Telnyx: https://developers.telnyx.com/
- PostgreSQL: https://www.postgresql.org/docs/
- Docker: https://docs.docker.com/

### Monitoring Tools (Optional)
- **Prometheus + Grafana**: Metrics and visualization
- **ELK Stack**: Log aggregation and analysis
- **Sentry**: Error tracking
- **UptimeRobot**: Uptime monitoring

---

## Post-Deployment Checklist

- [ ] All services running (`docker ps`)
- [ ] SSL certificate installed and valid
- [ ] Database migrations completed
- [ ] Admin user created
- [ ] Firewall configured
- [ ] Backups automated and tested
- [ ] Monitoring alerts configured
- [ ] DNS records propagated
- [ ] Test call successful
- [ ] API responding correctly
- [ ] Frontend accessible via HTTPS
- [ ] Telnyx integration working
- [ ] Log rotation configured
- [ ] Health check scripts running
- [ ] Documentation updated with production URLs

---

**Production Ready!** 🚀

For additional support or custom deployment assistance, please contact your system administrator.
