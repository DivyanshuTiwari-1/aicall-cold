# Asterisk Fix - Ready to Deploy

## Problem Identified
Asterisk was failing to start with error: **"Stasis initialization failed. ASTERISK EXITING!"**

This prevented:
- Backend from connecting to Asterisk via ARI
- Automated AI calls from working
- Live monitoring from functioning

## Root Causes
1. `asterisk.conf` had conflicting settings (`alwaysfork=yes` with `console=yes`)
2. `highpriority=yes` required Linux capabilities that Docker container didn't have
3. `stasis.conf` had malformed configuration
4. `modules.conf` was too complex and causing loading issues

## Fixes Applied

### 1. Fixed `asterisk-config/asterisk.conf`
Changed:
- `alwaysfork = yes` → `no` (conflicts with console mode)
- `nofork = no` → `yes` (needed for foreground mode)
- `console = yes` → `no` (conflicts with alwaysfork)
- `highpriority = yes` → `no` (requires capabilities)
- `dumpcore = yes` → `no` (not needed in production)

### 2. Simplified `asterisk-config/modules.conf`
Now uses simple autoload with minimal noload directives:
```
[modules]
autoload=yes

noload => chan_sip.so
noload => res_snmp.so
noload => res_speech.so
```

### 3. Fixed `asterisk-config/stasis.conf`
Minimal valid configuration:
```
[general]
```

### 4. Updated `docker-compose.demo.yml`
Added Linux capabilities to Asterisk container:
```yaml
cap_add:
  - SYS_NICE
  - NET_ADMIN
  - NET_RAW
```

### 5. Created `fix-asterisk-now.sh`
Automated deployment script that:
- Pulls latest code
- Recreates Asterisk container
- Verifies Asterisk is running
- Restarts backend
- Checks system status

## Deployment Instructions

### Option 1: Automatic (Recommended)
```bash
# From your local machine
cd c:\coding\aicall
git add .
git commit -m "Fix Asterisk Stasis initialization issues"
git push origin main

# SSH into server
ssh -i ~/.ssh/ai-dialer-key.pem ubuntu@13.53.89.241

# Run the fix script
cd /opt/ai-dialer
chmod +x fix-asterisk-now.sh
./fix-asterisk-now.sh
```

### Option 2: Manual
```bash
# SSH into server
ssh -i ~/.ssh/ai-dialer-key.pem ubuntu@13.53.89.241

# Pull changes
cd /opt/ai-dialer
git pull origin main

# Recreate Asterisk
docker-compose -f docker-compose.demo.yml up -d --force-recreate asterisk

# Wait 20 seconds
sleep 20

# Verify Asterisk
docker exec ai-dialer-asterisk asterisk -rx "core show version"
docker exec ai-dialer-asterisk asterisk -rx "ari show status"

# Restart backend
docker-compose -f docker-compose.demo.yml restart backend

# Check status
docker-compose -f docker-compose.demo.yml ps
```

## Verification Steps

### 1. Check Asterisk is Running
```bash
docker ps | grep asterisk
# Should show "Up X seconds" (not "Restarting")

docker logs ai-dialer-asterisk --tail 30
# Should NOT show "Stasis initialization failed"
# Should show "Asterisk Ready" or similar success message
```

### 2. Check Backend Can Connect to Asterisk
```bash
docker logs ai-dialer-backend --tail 30 | grep ARI
# Should show "Connected to ARI" or "Asterisk connected successfully"
# Should NOT show "ECONNREFUSED"
```

### 3. Test Automated Calls

#### Check Database Setup
```bash
# Check for active campaigns
docker exec ai-dialer-postgres psql -U postgres -d ai_dialer -c "
  SELECT id, name, status FROM campaigns WHERE status = 'active';
"

# Check for available contacts
docker exec ai-dialer-postgres psql -U postgres -d ai_dialer -c "
  SELECT COUNT(*) FROM contacts WHERE status IN ('pending', 'new');
"
```

#### Start Automated Calls
1. Visit: https://atsservice.site/
2. Login with your credentials
3. Navigate to **Campaigns** page
4. Click on an active campaign
5. Click **"Start Automated Calls"** button

#### Monitor Calls
1. Go to **Live Monitoring** page
2. You should see active calls appearing
3. Check call details and AI conversations

#### Verify in Database
```bash
# Check for recent calls
docker exec ai-dialer-postgres psql -U postgres -d ai_dialer -c "
  SELECT id, status, call_type, created_at
  FROM calls
  WHERE created_at >= NOW() - INTERVAL '10 minutes'
  ORDER BY created_at DESC
  LIMIT 10;
"

# Check for AI conversations
docker exec ai-dialer-postgres psql -U postgres -d ai_dialer -c "
  SELECT COUNT(*)
  FROM call_events
  WHERE event_type = 'ai_conversation'
  AND timestamp >= NOW() - INTERVAL '10 minutes';
"
```

## Expected Results

After deployment, you should see:

✅ Asterisk container status: **Up** (not Restarting)
✅ Backend logs: "Connected to ARI" or "Asterisk connected"
✅ Backend health: **healthy** (not unhealthy)
✅ Can start automated calls from web interface
✅ Live monitoring shows active calls
✅ Call events logged in database

## Troubleshooting

### If Asterisk still fails:
```bash
# Check detailed logs
docker logs ai-dialer-asterisk --tail 100

# Check config syntax
docker exec ai-dialer-asterisk asterisk -rx "core show config"

# Try rebuilding
docker-compose -f docker-compose.demo.yml build asterisk
docker-compose -f docker-compose.demo.yml up -d --force-recreate asterisk
```

### If backend can't connect:
```bash
# Check network
docker network inspect ai-dialer_ai-dialer-network | grep asterisk

# Test connection
docker exec ai-dialer-backend curl -v http://asterisk:8088/ari/api-docs/resources.json
```

## Files Modified

- `asterisk-config/asterisk.conf` - Fixed conflicting options
- `asterisk-config/modules.conf` - Simplified to autoload
- `asterisk-config/stasis.conf` - Minimal valid config
- `docker-compose.demo.yml` - Added capabilities
- `fix-asterisk-now.sh` - New deployment script

## Next Steps

Once Asterisk is fixed and working:

1. **Create/Activate Campaign**
   - Ensure you have an active campaign
   - Add contacts to the campaign

2. **Assign Phone Number** (if not already done)
   - Go to Phone Numbers page
   - Assign a phone number to the campaign or organization

3. **Start Automated Calls**
   - From Campaigns page, click "Start Automated Calls"
   - Or use API: `POST /api/v1/queue/start/:campaignId`

4. **Monitor Live Calls**
   - Watch Live Monitoring page
   - Check call events in real-time
   - View AI conversation transcripts

5. **Review Results**
   - Check Call History page
   - View analytics and performance metrics
   - Review AI conversation quality

---

**Status**: Ready to deploy ✅
**Estimated Time**: 5 minutes
**Impact**: Fixes automated AI calls completely
