# Set Up GitHub Secrets for Auto-Deployment

## Step 1: Get Your SSH Key

On your Windows machine, copy your SSH key:

```powershell
# Copy SSH key to clipboard
Get-Content ~/.ssh/ai-dialer-key.pem | Set-Clipboard
```

## Step 2: Add Secrets to GitHub

Go to your repository settings:
**https://github.com/DivyanshuTiwari-1/aicall-cold/settings/secrets/actions**

Click **"New repository secret"** and add these 3 required secrets:

### Secret 1: PRODUCTION_HOST
- **Name:** `PRODUCTION_HOST`
- **Value:** `13.53.89.241`
- Click "Add secret"

### Secret 2: PRODUCTION_USER
- **Name:** `PRODUCTION_USER`
- **Value:** `ubuntu`
- Click "Add secret"

### Secret 3: PRODUCTION_SSH_KEY
- **Name:** `PRODUCTION_SSH_KEY`
- **Value:** Paste the SSH key from your clipboard
  - Should start with `-----BEGIN RSA PRIVATE KEY-----` or `-----BEGIN OPENSSH PRIVATE KEY-----`
  - Should end with `-----END RSA PRIVATE KEY-----` or `-----END OPENSSH PRIVATE KEY-----`
- Click "Add secret"

### Optional Secret 4: PRODUCTION_APP_DIR
- **Name:** `PRODUCTION_APP_DIR`
- **Value:** `/opt/ai-dialer`
- Click "Add secret"

## ✅ Verify Secrets Are Added

After adding all secrets, you should see:
- ✅ PRODUCTION_HOST
- ✅ PRODUCTION_USER
- ✅ PRODUCTION_SSH_KEY
- ✅ PRODUCTION_APP_DIR (optional)

## 🔄 Re-run Failed Deployment

After adding secrets:
1. Go to: https://github.com/DivyanshuTiwari-1/aicall-cold/actions
2. Click on the failed workflow run
3. Click "Re-run jobs" → "Re-run failed jobs"

The deployment should now work!

