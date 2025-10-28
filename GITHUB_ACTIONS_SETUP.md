# GitHub Actions Auto-Deployment Setup

This guide will help you set up automatic deployments from GitHub to your production server.

## 🚀 How It Works

When you push code to the `main` branch:
1. **Code changes detected** - GitHub Actions checks what changed
2. **Smart rebuild** - Only rebuilds if `package.json` or `Dockerfile` changed
3. **Quick restart** - For code-only changes, just restarts containers
4. **Health checks** - Verifies deployment was successful
5. **Notification** - Shows success/failure in GitHub UI

## ⚙️ Setup GitHub Secrets

You need to configure 3 secrets in your GitHub repository:

### Step 1: Go to GitHub Secrets Settings

1. Open your repository: https://github.com/DivyanshuTiwari-1/aicall-cold
2. Click **Settings** (top menu)
3. Click **Secrets and variables** → **Actions** (left sidebar)
4. Click **New repository secret**

### Step 2: Add Required Secrets

#### Secret 1: `PRODUCTION_HOST`
- **Name:** `PRODUCTION_HOST`
- **Value:** `13.53.89.241`

#### Secret 2: `PRODUCTION_USER`
- **Name:** `PRODUCTION_USER`
- **Value:** `ubuntu`

#### Secret 3: `PRODUCTION_SSH_KEY`
- **Name:** `PRODUCTION_SSH_KEY`
- **Value:** Content of your SSH private key

**To get your SSH key content:**

**Windows PowerShell:**
```powershell
Get-Content ~/.ssh/ai-dialer-key.pem | Out-String
```

**Or manually:**
1. Open file: `C:\Users\<YourUsername>\.ssh\ai-dialer-key.pem`
2. Copy ALL content including:
   - `-----BEGIN RSA PRIVATE KEY-----`
   - All the encoded text
   - `-----END RSA PRIVATE KEY-----`
3. Paste into the secret value field

### Step 3: Verify Secrets

After adding all 3 secrets, you should see:
```
✓ PRODUCTION_HOST
✓ PRODUCTION_USER  
✓ PRODUCTION_SSH_KEY
```

## 🎯 Usage

### Automatic Deployment

Every time you push to `main` branch:
```bash
git add .
git commit -m "Your changes"
git push origin main
```

GitHub Actions will automatically:
1. Pull latest code to server
2. Rebuild containers (only if needed)
3. Restart services
4. Verify deployment

### Manual Deployment

You can also trigger deployment manually:
1. Go to **Actions** tab in GitHub
2. Click **Deploy to Production**
3. Click **Run workflow** button
4. Click **Run workflow** (green button)

## 📊 Monitoring Deployments

### View Deployment Status

1. Go to **Actions** tab in your repository
2. Click on the running workflow
3. Watch real-time logs

### Deployment Stages

- ✅ **Deployment Info** - Shows commit details
- ✅ **Validate SSH** - Checks secrets are configured
- ✅ **Smart Deploy** - Pulls code, rebuilds if needed, restarts
- ✅ **Verify Deployment** - Tests endpoints and health

### Success Indicators

When successful, you'll see:
```
✅ Backend health check passed
✅ Frontend is accessible  
✅ Domain (atsservice.site) is accessible
✅ DEPLOYMENT SUCCESSFUL!
```

## 🔄 Deployment Behavior

### Code-Only Changes (Fast - ~30 seconds)

When you change `.js`, `.jsx`, or other code files:
- ✅ No rebuild
- ✅ Just pulls code
- ✅ Restarts containers
- ✅ Changes are live immediately

**Example:**
```bash
# Edit a React component
vim client/src/pages/Dashboard.js

git add .
git commit -m "Update dashboard UI"
git push  # Deploys in ~30 seconds
```

### Dependency Changes (Slower - ~3-5 minutes)

When you change `package.json` or `Dockerfile`:
- 🔨 Rebuilds affected container
- 📦 Installs new dependencies
- 🔄 Restarts services

**Example:**
```bash
# Add a new npm package
cd client
npm install axios
git add package.json package-lock.json
git commit -m "Add axios for API calls"
git push  # Rebuilds frontend, takes 3-5 minutes
```

## 🐛 Troubleshooting

### Deployment Failed?

1. **Check GitHub Actions logs:**
   - Go to Actions tab
   - Click on the failed workflow
   - Read error messages

2. **Common Issues:**

**SSH Connection Failed:**
```
❌ Error: Failed to connect to server
```
**Solution:** Check `PRODUCTION_HOST`, `PRODUCTION_USER`, and `PRODUCTION_SSH_KEY` secrets

**Git Pull Failed:**
```
❌ Error: Could not read from remote repository
```
**Solution:** Ensure server can access GitHub. Run on server:
```bash
ssh -i ~/.ssh/ai-dialer-key.pem ubuntu@13.53.89.241
cd ~/aicall
git pull origin main  # Test manually
```

**Docker Build Failed:**
```
❌ Error: The command '/bin/sh -c npm ci' returned a non-zero code
```
**Solution:** Check `package.json` syntax and dependencies

**Services Not Starting:**
```
⚠️ Backend health check failed
```
**Solution:** Check logs on server:
```bash
ssh -i ~/.ssh/ai-dialer-key.pem ubuntu@13.53.89.241
cd ~/aicall
docker compose logs backend --tail=100
```

### Manual Rollback

If deployment breaks production:

```bash
# SSH to server
ssh -i ~/.ssh/ai-dialer-key.pem ubuntu@13.53.89.241
cd ~/aicall

# Roll back to previous commit
git log --oneline -5  # Find previous commit
git reset --hard <previous-commit-sha>

# Restart services
docker compose down
docker compose up -d
```

## 📝 Best Practices

### 1. Test Locally First
```bash
# Always test before pushing
docker compose up -d
# Test your changes
docker compose down
```

### 2. Use Meaningful Commit Messages
```bash
# Good ✅
git commit -m "Fix: Resolve login redirect issue"
git commit -m "Feature: Add call recording export"
git commit -m "Chore: Update dependencies"

# Bad ❌
git commit -m "fix"
git commit -m "changes"
git commit -m "update"
```

### 3. Small, Frequent Commits
```bash
# Deploy small changes often
git add client/src/pages/Dashboard.js
git commit -m "Update dashboard stats display"
git push  # Quick 30-second deployment

# Rather than large changes
git add .  # 100 files
git commit -m "Massive update"  # Risky
```

### 4. Monitor After Deployment
After each deployment:
1. Visit https://atsservice.site/
2. Test the changed feature
3. Check for console errors
4. Verify backend is responding

### 5. Check Logs if Issues
```bash
# If something seems wrong
ssh -i ~/.ssh/ai-dialer-key.pem ubuntu@13.53.89.241
cd ~/aicall
docker compose ps  # Check container status
docker compose logs --tail=50  # Check recent logs
```

## 🎉 Success Example

Typical successful deployment:

```
Push code → GitHub → GitHub Actions → Server
   │           │           │             │
   └───────────┴───────────┴─────────────┘
         ✅ Deployed in 30 seconds!
```

**GitHub Actions Output:**
```
✅ Deployment Info
✅ Validate SSH Configuration
✅ Smart Deploy to Production
  📥 Pulling latest code...
  📝 Changed files:
    - client/src/pages/Dashboard.js
    - server/routes/analytics.js
  🔄 Restarting services...
  ✅ Backend is healthy
  🧹 Cleaning up old images...
  ✅ Deployment completed successfully!
✅ Verify Deployment
  ✅ Backend health check passed
  ✅ Frontend is accessible
  ✅ Domain (atsservice.site) is accessible
✅ DEPLOYMENT SUCCESSFUL!
```

## 🔐 Security Notes

- SSH key is stored securely in GitHub Secrets
- Only accessible by GitHub Actions
- Never exposed in logs
- Encrypted at rest

## 📚 Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [SSH Key Management](https://docs.github.com/en/authentication)

---

## 🆘 Need Help?

If you encounter issues:
1. Check the **Troubleshooting** section above
2. Review GitHub Actions logs
3. SSH to server and check docker logs
4. Ensure all secrets are configured correctly

**Your deployment should now work automatically! 🚀**

