# 🚀 QUICK FIX - Run This Now!

## Your Problem
You push changes to GitHub but they don't show up on https://atsservices.site/

## The Cause
Multiple duplicate containers are running from different docker-compose files, causing conflicts.

## The Solution (30 seconds)

### On Your Server

```bash
# 1. SSH to your server
ssh ubuntu@13.53.89.241

# 2. Go to your project directory
cd /opt/ai-dialer
# (or wherever your PRODUCTION_APP_DIR points to)

# 3. Run the one-command fix
curl -sSL https://raw.githubusercontent.com/<your-repo>/main/fix-deployment-now.sh | bash
```

**OR if you already have the files:**

```bash
cd /opt/ai-dialer
chmod +x fix-deployment-now.sh
./fix-deployment-now.sh
```

This single script will:
- ✅ Stop all duplicate containers
- ✅ Clean up conflicts
- ✅ Pull latest code from GitHub
- ✅ Deploy fresh containers
- ✅ Run health checks
- ✅ Verify everything works

**Time: 2-3 minutes**

---

## What It Does

### Step 1: Checks Status
Shows you what containers are currently running and identifies duplicates

### Step 2: Cleanup
Stops and removes ALL ai-dialer containers (your data is safe in volumes!)

### Step 3: Fresh Deployment
- Pulls latest code from GitHub
- Creates a backup of your database
- Rebuilds all containers from scratch
- Starts services

### Step 4: Verification
- Tests backend health
- Tests frontend health
- Tests database connection
- Tests Redis connection
- Runs database migrations

---

## After Running the Fix

### ✅ Your system will be clean with:
- Exactly 5 containers running (postgres, redis, backend, frontend, asterisk)
- No duplicates
- Latest code from GitHub
- All services healthy

### ✅ GitHub auto-deployment will work:
- Push to `main` branch
- Wait 2-3 minutes
- Changes appear on https://atsservices.site/

---

## Verify It Worked

```bash
# Check running containers (should see exactly 5)
docker ps | grep ai-dialer

# Test backend
curl http://localhost:3000/health

# Test frontend
curl http://localhost:3001

# View logs
docker-compose -f docker-compose.demo.yml logs --tail 50
```

Then visit: **https://atsservices.site/** in your browser

---

## Need More Details?

See the complete guide: [FIX_DEPLOYMENT_GUIDE.md](./FIX_DEPLOYMENT_GUIDE.md)

---

## Still Having Issues?

Run the diagnostic tool:

```bash
chmod +x check-deployment-status.sh
./check-deployment-status.sh
```

This will show you exactly what's wrong and what to do.

---

## Manual Cleanup (If Script Fails)

```bash
# Stop everything
docker stop $(docker ps -a --filter "name=ai-dialer" -q)

# Remove all containers
docker rm $(docker ps -a --filter "name=ai-dialer" -q)

# Stop via each compose file
docker-compose -f docker-compose.demo.yml down
docker-compose -f docker-compose.simplified.yml down
docker-compose -f docker-compose.yml down

# Start fresh
docker-compose -f docker-compose.demo.yml up -d --build
```

---

## 🎉 Success!

Once the script completes successfully:

1. Your deployment is clean
2. No duplicate containers
3. Latest code is running
4. GitHub auto-deploy is working
5. Future pushes will propagate automatically

**You're all set!** 🚀
