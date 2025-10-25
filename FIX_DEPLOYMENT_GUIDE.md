# 🔧 Fix Deployment Issues - Complete Guide

## 🚨 Problem: Changes Not Propagating from GitHub

If you're pushing changes to GitHub but they're not showing up on https://atsservices.site/, the issue is likely **duplicate containers** running from different docker-compose files.

---

## ✅ SOLUTION (Run on Your Server)

### Step 1: SSH to Your Server

```bash
ssh -i "C:\Users\sonti\.ssh\ai-dialer-key.pem" ubuntu@13.53.89.241
# Or use your configured SSH method
```

### Step 2: Navigate to Project Directory

```bash
cd /opt/ai-dialer
# Or wherever your project is deployed (check PRODUCTION_APP_DIR secret)
```

### Step 3: Check Current Status

```bash
chmod +x check-deployment-status.sh
./check-deployment-status.sh
```

This will show you:
- ✅ What containers are running
- ⚠️  Any duplicate containers
- 🔍 Which docker-compose file is active
- 🌐 Service health status

### Step 4: Clean Up ALL Containers

```bash
chmod +x cleanup-all-containers.sh
./cleanup-all-containers.sh
```

This will:
- Stop all ai-dialer containers
- Remove duplicate containers
- Clean up unused images
- **Preserve all your data** (volumes are safe!)

### Step 5: Restart with Correct Configuration

```bash
chmod +x update-production-auto.sh
./update-production-auto.sh
```

This will:
- Pull latest code from GitHub
- Build fresh containers
- Start services with correct compose file
- Run health checks

---

## 🎯 Verify It's Working

### After running the cleanup and restart:

```bash
# Check running containers
docker ps | grep ai-dialer

# Should show EXACTLY these containers:
# - ai-dialer-postgres
# - ai-dialer-redis
# - ai-dialer-backend
# - ai-dialer-frontend
# - ai-dialer-asterisk
# (Maybe ai-dialer-speech if using simplified version)
```

### Test the site:

```bash
# Test backend
curl http://localhost:3000/health

# Test frontend
curl http://localhost:3001

# Both should return successful responses
```

Then visit: **https://atsservices.site/**

---

## 🔄 GitHub Auto-Deployment (Already Configured)

Your GitHub Actions workflow is configured to auto-deploy on every push to `main`. It uses:

- **Workflow file**: `.github/workflows/deploy-production.yml`
- **Deployment script**: `update-production-auto.sh`
- **Compose file**: `docker-compose.demo.yml`

### How it works:

1. You push to `main` branch
2. GitHub Actions triggers automatically
3. Connects to your server via SSH
4. Pulls latest code
5. Rebuilds containers
6. Restarts services
7. Runs health checks

### Required GitHub Secrets (Already Set):

- `PRODUCTION_HOST` - Your server IP (13.53.89.241)
- `PRODUCTION_USER` - SSH user (ubuntu)
- `PRODUCTION_SSH_KEY` - Your SSH private key
- `PRODUCTION_APP_DIR` - Project directory (/opt/ai-dialer)

---

## 🐛 Common Issues & Fixes

### Issue 1: "Duplicate containers running"

**Symptom**: Multiple containers with same name, or containers from different compose files

**Fix**:
```bash
./cleanup-all-containers.sh
./update-production-auto.sh
```

### Issue 2: "Port already in use"

**Symptom**: Container won't start, error about port 3000/3001/5432 already in use

**Fix**:
```bash
# Find what's using the port
sudo lsof -i :3000
sudo lsof -i :3001

# Kill the process or clean up containers
./cleanup-all-containers.sh
```

### Issue 3: "Changes pushed but old code still running"

**Symptom**: GitHub shows your commit, but website shows old code

**Fix**:
```bash
# Verify git is up to date
git fetch origin
git status

# If behind, pull and rebuild
git pull origin main
docker-compose -f docker-compose.demo.yml up -d --build --force-recreate
```

### Issue 4: "Frontend shows 404 or blank page"

**Symptom**: Backend works but frontend broken

**Fix**:
```bash
# Rebuild frontend with no cache
docker-compose -f docker-compose.demo.yml build --no-cache frontend
docker-compose -f docker-compose.demo.yml up -d frontend

# Clear browser cache
# Press Ctrl+Shift+R or open incognito window
```

---

## 📦 Which Docker Compose File to Use?

Your repository has multiple compose files. Here's what each is for:

| File | Purpose | Status |
|------|---------|--------|
| `docker-compose.demo.yml` | **Production deployment** | ✅ **USE THIS** |
| `docker-compose.simplified.yml` | Simplified/budget version | Optional |
| `docker-compose.yml` | Development/local | Development only |
| `docker-compose.services.yml` | Service components | Development only |

**For production auto-deployment, GitHub Actions uses `docker-compose.demo.yml`**

---

## 🔧 Manual Deployment Workflow

If you want to deploy manually without GitHub Actions:

```bash
# 1. SSH to server
ssh ubuntu@your-server

# 2. Navigate to project
cd /opt/ai-dialer

# 3. Pull latest changes
git pull origin main

# 4. Rebuild and restart
docker-compose -f docker-compose.demo.yml up -d --build

# 5. Check status
docker-compose -f docker-compose.demo.yml ps

# 6. View logs if needed
docker-compose -f docker-compose.demo.yml logs -f backend
```

---

## 🎯 Best Practices Going Forward

### 1. Always push to GitHub first
```bash
git add .
git commit -m "Your changes"
git push origin main
```

### 2. GitHub Actions will auto-deploy
- Wait 2-3 minutes for deployment
- Check GitHub Actions tab for status
- Verify at https://atsservices.site/

### 3. If something goes wrong
```bash
# SSH to server and check
./check-deployment-status.sh

# View deployment logs
docker-compose -f docker-compose.demo.yml logs --tail 100

# Restart if needed
docker-compose -f docker-compose.demo.yml restart
```

### 4. Weekly maintenance (optional)
```bash
# Clean up old images and free disk space
docker system prune -af --volumes

# Check disk usage
df -h
docker system df
```

---

## 📊 Monitoring Your Deployment

### Check deployment status anytime:
```bash
./check-deployment-status.sh
```

### View live logs:
```bash
# All services
docker-compose -f docker-compose.demo.yml logs -f

# Specific service
docker logs -f ai-dialer-backend
docker logs -f ai-dialer-frontend
```

### Check resource usage:
```bash
docker stats ai-dialer-backend ai-dialer-frontend
```

---

## 🆘 Emergency Rollback

If a deployment breaks everything:

```bash
# 1. Stop current deployment
docker-compose -f docker-compose.demo.yml down

# 2. Revert to previous commit
git log --oneline -5  # Find the commit hash
git reset --hard <previous-commit-hash>

# 3. Redeploy
./update-production-auto.sh

# 4. Or restore from backup
cd backups
ls -lt  # Find latest backup
gunzip < backup_YYYYMMDD_HHMMSS.sql.gz | \
  docker exec -i ai-dialer-postgres psql -U ai_dialer_user ai_dialer_prod
```

---

## ✅ Checklist: Is Everything Working?

Run through this checklist after deployment:

- [ ] Only one set of containers running (no duplicates)
- [ ] Backend responds: `curl http://localhost:3000/health`
- [ ] Frontend responds: `curl http://localhost:3001`
- [ ] Database is healthy: `docker exec ai-dialer-postgres pg_isready`
- [ ] Redis is healthy: `docker exec ai-dialer-redis redis-cli ping`
- [ ] Website loads: https://atsservices.site/
- [ ] Can login to dashboard
- [ ] No errors in logs: `docker-compose -f docker-compose.demo.yml logs --tail 50`

---

## 🎉 Success!

Once you've run through these steps, your deployment should be clean and working correctly. Any future pushes to GitHub will automatically deploy to your site!

**Summary of what you did:**
1. ✅ Cleaned up duplicate containers
2. ✅ Ensured GitHub Actions uses correct compose file
3. ✅ Verified deployment is healthy
4. ✅ Set up monitoring and maintenance scripts

**Your changes will now propagate automatically!** 🚀
