# Fix Deployment Issues - Step by Step Guide

Your GitHub Actions deployment failed due to:
1. ❌ Missing GitHub secrets
2. ❌ Server out of disk space

## 🎯 Quick Fix (3 Steps)

### Step 1: Clean Up Server Disk Space

SSH to your production server and clean up:

```bash
# SSH to server
ssh -i ~/.ssh/ai-dialer-key.pem ubuntu@13.53.89.241

# Quick cleanup
cd /opt/ai-dialer
docker system prune -af
docker image prune -af

# Check disk space
df -h /
```

Or run the comprehensive cleanup script:

```bash
# Copy cleanup script to server
scp -i ~/.ssh/ai-dialer-key.pem cleanup-production-disk.sh ubuntu@13.53.89.241:/opt/ai-dialer/

# SSH and run it
ssh -i ~/.ssh/ai-dialer-key.pem ubuntu@13.53.89.241
cd /opt/ai-dialer
chmod +x cleanup-production-disk.sh
./cleanup-production-disk.sh
```

### Step 2: Add GitHub Secrets

1. **Copy your SSH key:**
   ```powershell
   # On Windows PowerShell
   Get-Content ~/.ssh/ai-dialer-key.pem | Set-Clipboard
   ```

2. **Go to GitHub Secrets:**
   - Open: https://github.com/DivyanshuTiwari-1/aicall-cold/settings/secrets/actions
   - Click "New repository secret"

3. **Add these 3 secrets:**

   | Secret Name | Value |
   |------------|-------|
   | `PRODUCTION_HOST` | `13.53.89.241` |
   | `PRODUCTION_USER` | `ubuntu` |
   | `PRODUCTION_SSH_KEY` | *Paste SSH key from clipboard* |
   | `PRODUCTION_APP_DIR` (optional) | `/opt/ai-dialer` |

### Step 3: Push and Deploy

Now commit and push the improved workflow:

```bash
# Commit the improved workflow
git add .github/workflows/deploy-production.yml
git add cleanup-production-disk.sh
git add SETUP_GITHUB_SECRETS.md
git add FIX_DEPLOYMENT_ISSUES.md
git commit -m "fix: Add disk space checks and cleanup script for deployments"
git push origin main
```

The deployment will now:
- ✅ Check disk space before deployment
- ✅ Auto-cleanup if space is low
- ✅ Deploy your Node.js-only automated calls flow
- ✅ Show clear error messages if issues occur

---

## 📊 What Was Improved

### 1. Workflow Now Checks Disk Space
Before deploying, the workflow:
- Checks available disk space
- If < 2GB free, runs automatic cleanup
- If still not enough, shows error with instructions
- Only proceeds if sufficient space available

### 2. Automatic Cleanup on Low Space
If disk space is low, the workflow automatically runs:
```bash
docker image prune -af
docker container prune -f
docker system prune -f
```

### 3. Better Error Messages
You'll now see clear messages like:
```
💾 Checking disk space...
   Available: 5GB
✅ Sufficient disk space available
```

Or if space is low:
```
❌ ERROR: Low disk space (0.8GB available)
   At least 2GB free space is required
🧹 Running automatic cleanup...
```

---

## 🔍 Verify Everything Works

After setting up secrets and cleaning disk:

1. **Check GitHub Actions:**
   - Go to: https://github.com/DivyanshuTiwari-1/aicall-cold/actions
   - You should see the deployment running
   - All steps should be green ✅

2. **Monitor Deployment:**
   ```bash
   # Watch in real-time
   ssh -i ~/.ssh/ai-dialer-key.pem ubuntu@13.53.89.241
   cd /opt/ai-dialer
   docker-compose -f docker-compose.demo.yml logs -f
   ```

3. **Test Your App:**
   - Frontend: https://atsservice.site/
   - Backend: https://atsservice.site/api/v1/health
   - Test automated calls flow!

---

## 🐛 Troubleshooting

### Issue: "No space left on device"
**Solution:**
```bash
# SSH to server
ssh -i ~/.ssh/ai-dialer-key.pem ubuntu@13.53.89.241

# Aggressive cleanup
docker system prune -af --volumes

# Check space
df -h /

# If still not enough, check what's using space
du -sh /* | sort -hr | head -10
```

### Issue: "PRODUCTION_HOST secret not set"
**Solution:**
- Go to GitHub secrets page
- Verify all 3 required secrets are added
- Secret names must be EXACT (case-sensitive)
- Re-run the workflow

### Issue: "Permission denied (publickey)"
**Solution:**
- Verify SSH key is correct in GitHub secrets
- Must include `-----BEGIN` and `-----END` lines
- Should be the PRIVATE key (not .pub file)
- No extra spaces or line breaks

### Issue: Deployment stuck or slow
**Solution:**
```bash
# Check server resources
ssh -i ~/.ssh/ai-dialer-key.pem ubuntu@13.53.89.241
top -n 1
free -h
df -h

# Restart if needed
cd /opt/ai-dialer
docker-compose -f docker-compose.demo.yml restart
```

---

## 📝 Summary

✅ **What You Fixed:**
1. Added disk space checks before deployment
2. Automatic cleanup when space is low
3. Clear error messages
4. GitHub secrets properly configured
5. Production server has free disk space

✅ **What's Improved:**
1. Deployments won't fail due to disk space
2. Automatic cleanup prevents future issues
3. Better visibility into deployment process
4. Node.js-only automated calls flow deployed

✅ **Next Steps:**
1. Add GitHub secrets (if not done)
2. Clean server disk space (if needed)
3. Push changes
4. Watch deployment succeed
5. Test automated calls end-to-end!

---

## 🎉 Your System is Ready!

Once deployment succeeds:
- ✅ Node.js-only automated calls flow active
- ✅ Real-time WebSocket conversations working
- ✅ LiveMonitor showing calls in real-time
- ✅ Call History saving transcripts
- ✅ No more PHP conflicts

**Test the flow:**
1. Create campaign
2. Add contacts
3. Start queue
4. Watch LiveMonitor → Active Calls
5. See conversation in real-time!

