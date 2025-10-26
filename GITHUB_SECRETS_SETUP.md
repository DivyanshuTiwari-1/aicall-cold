# GitHub Secrets Setup for Auto-Deploy

## ❌ Current Issue
Your GitHub Actions deployment is failing because the SSH secrets are not configured.

## ✅ Fix: Add GitHub Secrets

### Step 1: Get Your SSH Private Key

On your Windows machine, run this to get the key content:

```powershell
Get-Content ~/.ssh/ai-dialer-key.pem | Set-Clipboard
```

This copies your SSH key to clipboard.

### Step 2: Add Secrets to GitHub

1. Go to: **https://github.com/DivyanshuTiwari-1/aicall-cold/settings/secrets/actions**

2. Click **"New repository secret"** for each of these:

#### Secret 1: `PRODUCTION_HOST`
- **Name:** `PRODUCTION_HOST`
- **Value:** `13.53.89.241`
- Click "Add secret"

#### Secret 2: `PRODUCTION_USER`
- **Name:** `PRODUCTION_USER`
- **Value:** `ubuntu`
- Click "Add secret"

#### Secret 3: `PRODUCTION_SSH_KEY`
- **Name:** `PRODUCTION_SSH_KEY`
- **Value:** Paste the SSH key you copied (from ~/.ssh/ai-dialer-key.pem)
  - Should start with `-----BEGIN RSA PRIVATE KEY-----`
  - Should end with `-----END RSA PRIVATE KEY-----`
- Click "Add secret"

#### Secret 4: `PRODUCTION_APP_DIR` (Optional)
- **Name:** `PRODUCTION_APP_DIR`
- **Value:** `/opt/ai-dialer`
- Click "Add secret"

### Step 3: Re-run the Deployment

After adding secrets, go to:
**https://github.com/DivyanshuTiwari-1/aicall-cold/actions**

Click on the failed workflow → Click "Re-run jobs" → "Re-run failed jobs"

---

## 🔒 Security Note

These secrets are:
- ✅ Encrypted by GitHub
- ✅ Never exposed in logs
- ✅ Only accessible during workflow runs
- ✅ Cannot be viewed after saving

---

## ✅ After Setup

Once secrets are added, every `git push` will:
1. ✅ Automatically detect what changed
2. ✅ Only rebuild changed services
3. ✅ Deploy to https://atsservice.site/
4. ✅ Clean up old images

No manual deployment needed!
