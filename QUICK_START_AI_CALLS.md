# 🚀 Quick Start: Test AI Automated Calls (20 Minutes)

## ⚡ URGENT - Run These Commands on Your Server NOW

### Step 1: Access Your Server (1 minute)

```bash
# SSH to your production server
# (Use whatever method works for you - terminal, PuTTY, web console, etc.)
```

### Step 2: Run Quick Fix Script (2 minutes)

```bash
cd /opt/ai-dialer

# Pull latest code and scripts
git pull origin main

# Make scripts executable
chmod +x test-live-ai-calls.sh start-test-calls.sh fix-automated-calls-now.sh

# Run the fix script
bash fix-automated-calls-now.sh
```

**This script will:**
- ✅ Pull latest code
- ✅ Restart backend (FastAGI server)
- ✅ Check all services
- ✅ Verify database
- ✅ Check campaigns and contacts
- ✅ Show current status

### Step 3: Test Complete System (3 minutes)

```bash
# Run comprehensive system test
bash test-live-ai-calls.sh
```

**This shows:**
- Docker container status
- Active campaigns
- Contact statistics
- Current active calls
- AI conversation logs
- Queue status
- System performance

### Step 4: Start 5 Test AI Calls (5 minutes)

```bash
# This will initiate 5 automated AI calls and monitor them
bash start-test-calls.sh
```

**Watch in real-time:**
- Call initiation
- AI ↔ Customer conversations
- Call completion
- Final statistics

### Step 5: Monitor Live Calls (Ongoing)

**Option A: Watch Active Calls**
```bash
# Refresh every 2 seconds
watch -n 2 'docker exec ai-dialer-postgres psql -U postgres -d ai_dialer -t -c "SELECT id, status, EXTRACT(EPOCH FROM (NOW() - created_at))::integer as age FROM calls WHERE status IN ('"'"'initiated'"'"', '"'"'in_progress'"'"') ORDER BY created_at DESC LIMIT 5;"'
```

**Option B: Watch Conversations**
```bash
# Real-time conversation logs
docker-compose -f docker-compose.demo.yml logs -f backend | grep -i "conversation"
```

**Option C: Watch FastAGI Activity**
```bash
# Real-time AGI activity
docker-compose -f docker-compose.demo.yml logs -f backend | grep -i "agi"
```

---

## 🔧 Troubleshooting

### Issue: No Active Calls Showing

**Check 1: Verify Queue is Running**
```bash
docker exec ai-dialer-backend curl http://localhost:3000/api/v1/queue/status
```

**Check 2: Check Calls in Database**
```bash
docker exec ai-dialer-postgres psql -U postgres -d ai_dialer -c "
SELECT id, status, call_type, created_at 
FROM calls 
WHERE status IN ('initiated', 'in_progress') 
ORDER BY created_at DESC LIMIT 5;
"
```

**Check 3: Verify FastAGI Server**
```bash
docker exec ai-dialer-backend ps aux | grep node
docker-compose -f docker-compose.demo.yml logs backend | grep "FastAGI" | tail -10
```

### Issue: Calls Not Connecting

**Check Asterisk Status**
```bash
docker exec asterisk asterisk -rx "core show channels"
docker exec asterisk asterisk -rx "ari show status"
```

**Check Telnyx SIP Connection**
```bash
docker exec asterisk asterisk -rx "pjsip show endpoints"
```

### Issue: No Conversation Logs

**Check Call Events**
```bash
docker exec ai-dialer-postgres psql -U postgres -d ai_dialer -c "
SELECT call_id, event_type, timestamp 
FROM call_events 
WHERE event_type = 'ai_conversation' 
ORDER BY timestamp DESC LIMIT 10;
"
```

**Check Backend Logs**
```bash
docker-compose -f docker-compose.demo.yml logs backend | grep -i "conversation\|process" | tail -20
```

---

## 📊 Key Metrics to Monitor

### 1. System Health
```bash
docker-compose -f docker-compose.demo.yml ps
```
**Expected:** All services "Up"

### 2. Active Calls
```bash
docker exec ai-dialer-postgres psql -U postgres -d ai_dialer -t -c "SELECT COUNT(*) FROM calls WHERE status IN ('initiated', 'in_progress');"
```
**Expected:** > 0 when queue is running

### 3. Conversation Turns
```bash
docker exec ai-dialer-postgres psql -U postgres -d ai_dialer -t -c "SELECT COUNT(*) FROM call_events WHERE event_type = 'ai_conversation' AND timestamp >= NOW() - INTERVAL '5 minutes';"
```
**Expected:** Increasing number

### 4. Queue Status
```bash
docker exec ai-dialer-backend curl -s http://localhost:3000/api/v1/queue/status | python3 -m json.tool
```
**Expected:** Shows active queues

---

## 🎯 Success Criteria (20 Minutes)

After running these scripts, you should have:

- [x] **Minute 0-2:** Scripts executed successfully
- [x] **Minute 2-5:** System health verified
- [x] **Minute 5-10:** 5 test calls initiated
- [x] **Minute 10-15:** Conversations logged in database
- [x] **Minute 15-20:** Calls completed, transcripts saved

### ✅ What Working System Looks Like:

1. **Docker Services:** All containers running
2. **FastAGI Server:** Listening on port 4573
3. **Active Calls:** Visible in database with status 'in_progress'
4. **Conversations:** Logged in call_events table
5. **Frontend:** LiveMonitor shows active calls
6. **WebSocket:** Connected (green indicator)
7. **Transcripts:** Saved to calls table after completion

---

## 🔥 Quick Commands Reference

```bash
# Check everything
bash test-live-ai-calls.sh

# Start test calls
bash start-test-calls.sh

# Watch live calls
watch -n 2 'docker exec ai-dialer-postgres psql -U postgres -d ai_dialer -t -c "SELECT COUNT(*) FROM calls WHERE status IN ('"'"'initiated'"'"', '"'"'in_progress'"'"');"'

# View latest conversation
docker exec ai-dialer-postgres psql -U postgres -d ai_dialer -c "SELECT event_data FROM call_events WHERE event_type = 'ai_conversation' ORDER BY timestamp DESC LIMIT 1;"

# Restart if needed
docker-compose -f docker-compose.demo.yml restart backend asterisk

# Check logs
docker-compose -f docker-compose.demo.yml logs --tail=50 backend
docker-compose -f docker-compose.demo.yml logs --tail=50 asterisk
```

---

## 💡 For 1000+ Calls Per Day

Your system is configured for:
- **Max Concurrent Calls:** 5 (configurable via `MAX_CONCURRENT_CALLS`)
- **Call Interval:** 30 seconds (configurable via `CALL_INTERVAL_MS`)
- **Daily Capacity:** ~2,880 calls/day (with current settings)

To scale to 1000+ calls/day, your current settings are sufficient.
To increase further:

```bash
# Edit docker-compose.demo.yml
# Add these environment variables to backend service:
# - MAX_CONCURRENT_CALLS=10
# - CALL_INTERVAL_MS=15000

# Restart
docker-compose -f docker-compose.demo.yml restart backend
```

---

## 🎉 You're Ready!

Once you see:
- ✅ Active calls in database
- ✅ Conversation turns being logged
- ✅ Real-time updates in LiveMonitor
- ✅ Transcripts saved after calls

**Your automated AI call system is working!** 🚀

Monitor via web interface:
- **Live Monitor:** https://atsservice.site/ (navigate to Live Monitoring)
- **Call History:** https://atsservice.site/calls

---

## ⚠️ IMPORTANT NOTES

1. **Test Phone Numbers:** The system will call the phone numbers in your contacts. Make sure they're test numbers!

2. **Telnyx Account:** Ensure you have Telnyx SIP configured and funded.

3. **Real Conversations:** The AI will actually talk to whoever answers. Use test numbers only!

4. **Cost:** Each call costs ~$0.011/minute via Telnyx SIP.

5. **DNC List:** The system respects Do Not Call lists automatically.

---

**Need help? Check the logs:**
```bash
docker-compose -f docker-compose.demo.yml logs -f
```

