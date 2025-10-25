# 🚀 SIMPLE UPDATE WORKFLOW

## ✅ CURRENT STATUS
Your production site is live at: **https://atsservice.site**

All containers are running successfully!

---

## 📝 HOW TO PUSH CHANGES TO PRODUCTION

### Step 1: Make Changes Locally (On Your Windows Machine)
```bash
# Make your code changes in C:\coding\aicall
# Test locally if needed
```

### Step 2: Commit and Push to GitHub
```bash
cd C:\coding\aicall

git add .
git commit -m "Your change description"
git push origin main
```

### Step 3: Deploy to Production (On Server)
```bash
# SSH to server
ssh -i "C:\Users\sonti\.ssh\ai-dialer-key.pem" ubuntu@13.53.89.241

# Go to project directory
cd /opt/ai-dialer

# Pull latest changes
git pull origin main

# Rebuild and restart (this takes 2-3 minutes)
docker-compose -f docker-compose.demo.yml up -d --build

# Check status
docker-compose -f docker-compose.demo.yml ps
```

### Step 4: Clear Browser Cache
```
Press: Ctrl + Shift + R
Or: Open Incognito window
```

**DONE!** Your changes are live! 🎉

---

## 🔧 COMMON COMMANDS

### Check Container Status
```bash
cd /opt/ai-dialer
docker-compose -f docker-compose.demo.yml ps
```

### View Logs
```bash
# All services
docker-compose -f docker-compose.demo.yml logs --tail 50

# Specific service
docker logs --tail 50 ai-dialer-backend
docker logs --tail 50 ai-dialer-frontend
```

### Restart a Service
```bash
docker-compose -f docker-compose.demo.yml restart backend
docker-compose -f docker-compose.demo.yml restart frontend
```

### Full Restart (if something is broken)
```bash
cd /opt/ai-dialer
docker-compose -f docker-compose.demo.yml down
docker-compose -f docker-compose.demo.yml up -d --build
```

---

## 🚨 IF SOMETHING BREAKS

### Frontend Won't Start
```bash
cd /opt/ai-dialer
docker logs ai-dialer-frontend

# If SSL error, check certificates exist:
ls -la /opt/ai-dialer/ssl/
```

### Backend Won't Start
```bash
cd /opt/ai-dialer
docker logs ai-dialer-backend

# Check .env file exists
ls -la /opt/ai-dialer/.env.production
```

### Database Issues
```bash
# Check database is running
docker-compose -f docker-compose.demo.yml ps postgres

# Access database
docker exec -it ai-dialer-postgres psql -U ai_dialer_user -d ai_dialer_prod
```

---

## 💡 IMPORTANT REMINDERS

1. **NEVER commit directly on the server**
   - Always push from your local machine first
   - Server should only `git pull`, never `git commit`

2. **Always clear browser cache after updates**
   - Press `Ctrl + Shift + R`
   - Or use Incognito mode

3. **Wait for rebuild to complete**
   - The `--build` flag takes 2-3 minutes
   - Don't panic if it's not instant

4. **Your data is safe**
   - Database is persistent (Docker volume)
   - Uploads are persistent (Docker volume)
   - Only code is updated

---

## 🔑 CREDENTIALS

**Admin Login:**
- Email: `admin@aidialer.com`
- Password: `Admin@123`

**Domain:** https://atsservice.site

**Server IP:** 13.53.89.241

**SSH Command:**
```bash
ssh -i "C:\Users\sonti\.ssh\ai-dialer-key.pem" ubuntu@13.53.89.241
```

---

## ✅ THAT'S IT!

Just remember these 3 steps:
1. **Push to GitHub** (from Windows)
2. **Pull on server** + **rebuild** (from SSH)
3. **Clear browser cache**

Your changes will be live!

