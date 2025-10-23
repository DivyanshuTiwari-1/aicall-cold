# 🚀 AI Dialer Demo Deployment - Quick Cheat Sheet

## What You Need to Run deploy.sh Successfully

### 1. **Get a Server (Your "your-server")**

Choose one option:

#### Option A: DigitalOcean (Easiest - $24/month)
```
1. Go to https://digitalocean.com
2. Create account
3. Click "Create" → "Droplets"
4. Choose:
   - Ubuntu 22.04 LTS
   - $24/mo plan (4GB RAM)
5. Click "Create"
6. Copy the IP address shown (e.g., 159.65.123.45)
```
**This IP is your "your-server"!**

#### Option B: AWS (Has free tier)
```
1. Go to https://aws.amazon.com
2. Launch EC2 instance
3. Choose Ubuntu 22.04 LTS
4. Type: t3.medium
5. Get Public IP from dashboard
```

#### Option C: Vultr, Linode, or any VPS provider
Just get an Ubuntu 22.04 server and note the IP address.

---

## 2. **Upload Project to Server**

### From Windows (your local machine):

```bash
# Open PowerShell or Command Prompt
cd c:\coding\aicall

# Upload files (replace 159.65.123.45 with YOUR server IP)
scp -r * root@159.65.123.45:/opt/ai-dialer/
```

**Or use WinSCP/FileZilla:**
- Connect to your server IP
- Upload all files to `/opt/ai-dialer/`

---

## 3. **Run the Automated Deploy Script**

### SSH to your server:

```bash
# Replace with YOUR server IP
ssh root@159.65.123.45
```

### Run the demo deploy script:

```bash
cd /opt/ai-dialer

# Make script executable
chmod +x deploy-demo.sh

# Run it!
./deploy-demo.sh
```

**The script will ask you for:**
1. ✅ Your Telnyx API Key (optional for demo)
2. ✅ Your Telnyx SIP credentials (optional)
3. ✅ Your Telnyx phone number (optional)

**Everything else is automated!**

---

## 4. **Access Your Demo**

After script completes (5-10 minutes):

```
Frontend: http://YOUR_SERVER_IP:3001
Login:    admin@demo.com
Password: Admin123!
```

**Example:**
```
http://159.65.123.45:3001
```

---

## Complete Manual Steps (If Script Fails)

### Step 1: Install Docker on Server

```bash
ssh root@YOUR_SERVER_IP

# Install Docker
curl -fsSL https://get.docker.com | sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### Step 2: Configure Environment

```bash
cd /opt/ai-dialer

# Get your server IP
SERVER_IP=$(curl -s ifconfig.me)
echo "Your IP: $SERVER_IP"

# Create environment file
nano .env.production
```

**Paste this (REPLACE SERVER_IP with your actual IP):**

```bash
NODE_ENV=production
SERVER_IP=159.65.123.45
DOMAIN=159.65.123.45
API_URL=http://159.65.123.45:3000
CLIENT_URL=http://159.65.123.45:3001

POSTGRES_DB=ai_dialer_prod
POSTGRES_USER=ai_dialer_user
POSTGRES_PASSWORD=$(openssl rand -base64 32)

REDIS_PASSWORD=$(openssl rand -base64 32)

JWT_SECRET=$(openssl rand -base64 64)
SESSION_SECRET=$(openssl rand -base64 32)

# Add your Telnyx credentials here
TELNYX_API_KEY=your_key_here
TELNYX_SIP_USERNAME=your_username
TELNYX_SIP_PASSWORD=your_password
TELNYX_DID=+1234567890

ARI_PASSWORD=$(openssl rand -base64 16)
```

Save: `Ctrl+X`, `Y`, `Enter`

### Step 3: Open Firewall Ports

```bash
sudo ufw allow 22/tcp
sudo ufw allow 3000/tcp
sudo ufw allow 3001/tcp
sudo ufw allow 5060/udp
sudo ufw enable
```

### Step 4: Start Services

```bash
cd /opt/ai-dialer

docker-compose -f docker-compose.demo.yml up -d --build
```

**Wait 5-10 minutes for build to complete**

### Step 5: Run Migrations

```bash
# Wait for backend to be ready
sleep 60

docker exec -it ai-dialer-backend npm run migrate
```

### Step 6: Create Admin User

```bash
docker exec -it ai-dialer-backend node scripts/create-admin.js
```

Enter:
- Email: admin@demo.com
- Password: Admin123!
- First Name: Admin
- Last Name: User

### Step 7: Access Demo

Open in browser:
```
http://YOUR_SERVER_IP:3001
```

---

## Troubleshooting

### "Can't connect to server IP"

```bash
# Check if services are running
docker ps

# Check firewall
sudo ufw status

# Check if ports are accessible
sudo netstat -tulpn | grep -E '3000|3001'
```

### "Services not starting"

```bash
# View logs
docker-compose -f docker-compose.demo.yml logs -f

# Restart everything
docker-compose -f docker-compose.demo.yml down
docker-compose -f docker-compose.demo.yml up -d
```

### "Frontend shows blank page"

```bash
# Rebuild frontend with correct IP
docker-compose -f docker-compose.demo.yml build --no-cache frontend
docker-compose -f docker-compose.demo.yml up -d frontend
```

### "Database errors"

```bash
# Check database is running
docker exec ai-dialer-postgres pg_isready -U ai_dialer_user

# Restart database
docker-compose -f docker-compose.demo.yml restart postgres

# Run migrations again
docker exec -it ai-dialer-backend npm run migrate
```

---

## Quick Commands

```bash
# View all logs
docker-compose -f docker-compose.demo.yml logs -f

# Restart service
docker-compose -f docker-compose.demo.yml restart backend

# Stop everything
docker-compose -f docker-compose.demo.yml down

# Start everything
docker-compose -f docker-compose.demo.yml up -d

# Check status
docker-compose -f docker-compose.demo.yml ps

# Get server IP
curl ifconfig.me
```

---

## Cost Summary

| Item | Cost | Notes |
|------|------|-------|
| DigitalOcean Server | $24/mo | Can delete after demo |
| Telnyx Trial | FREE | $10 credit |
| Telnyx Phone Number | $2/mo | Optional for demo |
| **Total** | **$24-26** | Delete server to stop charges |

---

## After Demo

### To stop and save money:

```bash
# Stop all services
docker-compose -f docker-compose.demo.yml down

# Delete server from cloud provider dashboard
# You only pay for what you used!
```

### To restart later:

```bash
docker-compose -f docker-compose.demo.yml up -d
```

---

## Getting Help

1. **Check logs first:**
   ```bash
   docker-compose -f docker-compose.demo.yml logs -f
   ```

2. **Verify services:**
   ```bash
   docker ps
   ```

3. **Test backend:**
   ```bash
   curl http://localhost:3000/health
   ```

4. **See full guide:**
   - Read `DEMO_DEPLOYMENT_IP_ONLY.md`

---

## Summary: 4 Steps to Demo

1. **Get Server** → Get IP address (e.g., 159.65.123.45)
2. **Upload Files** → `scp` or WinSCP to `/opt/ai-dialer/`
3. **Run Script** → `./deploy-demo.sh` on server
4. **Access** → Open `http://YOUR_IP:3001` in browser

**That's it!** 🎉

---

## Example Session

```bash
# 1. Upload from Windows
C:\coding\aicall> scp -r * root@159.65.123.45:/opt/ai-dialer/

# 2. SSH to server
C:\coding\aicall> ssh root@159.65.123.45

# 3. Run deploy script
root@server:~# cd /opt/ai-dialer
root@server:/opt/ai-dialer# chmod +x deploy-demo.sh
root@server:/opt/ai-dialer# ./deploy-demo.sh

# Script runs... wait 5-10 minutes...

# 4. Open browser
http://159.65.123.45:3001
Login: admin@demo.com / Admin123!
```

**Done!** 🚀
