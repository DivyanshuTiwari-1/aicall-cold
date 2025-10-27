# 🚀 PRODUCTION AI CALLS TEST - RUN NOW

## One-Command Test (Do This First!)

SSH to your server and run this **single command**:

```bash
ssh your-server
cd /opt/ai-dialer && git pull origin main && chmod +x *.sh && bash verify-complete-flow.sh && bash start-test-calls.sh
```

---

## Step-by-Step Instructions (20 Minutes)

### 1️⃣ SSH to Your Production Server (1 min)

```bash
# Use whatever method works for you
ssh ubuntu@your-server-ip
# OR use PuTTY, web console, etc.
```

### 2️⃣ Navigate and Pull Latest Code (1 min)

```bash
cd /opt/ai-dialer
git pull origin main
chmod +x *.sh  # Make scripts executable
```

### 3️⃣ Verify System Health (2 min)

```bash
bash verify-complete-flow.sh
```

**This checks:**
- ✅ All Docker containers running
- ✅ FastAGI server on port 4573
- ✅ Database schema correct
- ✅ Asterisk configured for Node.js (not PHP)
- ✅ Campaigns and contacts ready
- ✅ Queue system operational
- ✅ WebSocket broadcaster ready
- ✅ Conversation engine ready

**Expected Output:** Green checkmarks with "SYSTEM READY FOR AUTOMATED AI CALLS!"

If you see any RED failures, fix them before proceeding.

---

### 4️⃣ Start Test Calls (5-10 min)

```bash
bash start-test-calls.sh
```

**This will:**
- Find your active campaign
- Select 5 contacts to call
- Initiate automated AI calls
- Monitor them in real-time
- Show conversations as they happen
- Display final statistics

**Watch for:**
- ✅ Calls showing as "initiated" → "in_progress"
- ✅ Conversation turns appearing (Customer ↔ AI)
- ✅ Calls completing with status "completed"

---

### 5️⃣ Monitor Live (Ongoing)

**Option A: Live Dashboard (Recommended)**

```bash
bash monitor-live-calls.sh
```

This gives you a beautiful real-time dashboard showing:
- Active calls RIGHT NOW
- Latest conversation turns
- Call statistics
- System health

Press `Ctrl+C` to exit.

**Option B: Watch Specific Things**

```bash
# Watch backend logs for conversations
docker-compose -f docker-compose.demo.yml logs -f backend | grep -i "conversation"

# Watch AGI activity
docker-compose -f docker-compose.demo.yml logs -f backend | grep -i "agi"

# Watch active calls in database
watch -n 2 'docker exec ai-dialer-postgres psql -U postgres -d ai_dialer -t -c "SELECT id, status FROM calls WHERE status IN ('"'"'initiated'"'"', '"'"'in_progress'"'"') ORDER BY created_at DESC LIMIT 5;"'
```

---

### 6️⃣ Check Frontend (Live Monitor)

Open your browser:

```
https://atsservice.site/
```

Navigate to: **Live Monitoring** → **Active Calls**

**You should see:**
- ✅ Green "Connected" indicator (WebSocket)
- ✅ Active calls listed in real-time
- ✅ Conversation turns updating live
- ✅ Call status changing dynamically

---

## 🔧 Troubleshooting

### Issue: No Active Calls Showing

**Solution 1: Check if queue is running**
```bash
docker exec ai-dialer-backend curl http://localhost:3000/api/v1/queue/status
```

**Solution 2: Manually check database**
```bash
docker exec ai-dialer-postgres psql -U postgres -d ai_dialer -c "SELECT id, status, created_at FROM calls WHERE status IN ('initiated', 'in_progress') ORDER BY created_at DESC LIMIT 5;"
```

**Solution 3: Restart backend**
```bash
docker-compose -f docker-compose.demo.yml restart backend
sleep 5
docker-compose -f docker-compose.demo.yml logs backend | grep "FastAGI"
```

---

### Issue: Calls Not Connecting

**Check Asterisk**
```bash
docker exec asterisk asterisk -rx "core show channels"
docker exec asterisk asterisk -rx "pjsip show endpoints"
```

**Check Telnyx SIP**
```bash
docker exec asterisk asterisk -rx "pjsip show registrations"
```

If not registered, check your Telnyx credentials in environment variables.

---

### Issue: No Conversations in Database

**Check call events**
```bash
docker exec ai-dialer-postgres psql -U postgres -d ai_dialer -c "SELECT call_id, event_type, timestamp FROM call_events WHERE event_type = 'ai_conversation' ORDER BY timestamp DESC LIMIT 10;"
```

**Check if FastAGI is being called**
```bash
docker-compose -f docker-compose.demo.yml logs backend | grep "AGI connection" | tail -20
```

**Check conversation-simple route**
```bash
docker-compose -f docker-compose.demo.yml logs backend | grep "conversation" | tail -20
```

---

### Issue: Frontend Not Updating

**Check WebSocket connection**
```bash
docker-compose -f docker-compose.demo.yml logs backend | grep -i "websocket"
```

**Check if broadcasts are happening**
```bash
docker-compose -f docker-compose.demo.yml logs backend | grep "broadcastConversationTurn"
```

**Refresh browser** and check console for WebSocket errors.

---

## 📊 Success Criteria

After running the test, you should have:

### ✅ In Database:
```bash
# Check calls
docker exec ai-dialer-postgres psql -U postgres -d ai_dialer -c "SELECT COUNT(*) FROM calls WHERE created_at >= NOW() - INTERVAL '10 minutes';"

# Check conversations
docker exec ai-dialer-postgres psql -U postgres -d ai_dialer -c "SELECT COUNT(*) FROM call_events WHERE event_type = 'ai_conversation' AND timestamp >= NOW() - INTERVAL '10 minutes';"
```

### ✅ In Frontend:
- Active calls visible in Live Monitor
- Real-time conversation updates
- WebSocket connected (green indicator)
- Call history showing completed calls

### ✅ In Logs:
```bash
docker-compose -f docker-compose.demo.yml logs backend | grep -E "AGI|conversation|Call initiated"
```

Should show:
- AGI connections established
- Conversations being processed
- Calls being initiated

---

## 🎯 Quick Commands Reference

```bash
# Full system check
bash verify-complete-flow.sh

# Start 5 test calls
bash start-test-calls.sh

# Live monitoring dashboard
bash monitor-live-calls.sh

# Check queue status
docker exec ai-dialer-backend curl http://localhost:3000/api/v1/queue/status

# View all active calls
docker exec ai-dialer-postgres psql -U postgres -d ai_dialer -c "SELECT id, status, created_at FROM calls WHERE status IN ('initiated', 'in_progress');"

# View latest conversation
docker exec ai-dialer-postgres psql -U postgres -d ai_dialer -c "SELECT event_data FROM call_events WHERE event_type = 'ai_conversation' ORDER BY timestamp DESC LIMIT 1;"

# Restart if needed
docker-compose -f docker-compose.demo.yml restart backend asterisk

# Check all logs
docker-compose -f docker-compose.demo.yml logs --tail=100 backend
```

---

## 🚀 For 1000+ Calls Per Day

Your current configuration:
- **Max Concurrent Calls:** 5
- **Call Interval:** 30 seconds
- **Daily Capacity:** ~2,880 calls/day

This is **MORE than enough** for 1000+ calls/day!

To increase concurrency (if needed):
```bash
# Edit docker-compose.demo.yml
# Add under backend service environment:
#   - MAX_CONCURRENT_CALLS=10
#   - CALL_INTERVAL_MS=15000

# Then restart
docker-compose -f docker-compose.demo.yml restart backend
```

---

## 📞 What You'll See During Test

### Minute 0-2: System Verification
```
✓ Docker services running
✓ FastAGI server ready
✓ Database healthy
✓ Campaign active
✓ Contacts available
```

### Minute 2-5: Calls Initiating
```
📞 Call 1: Initiated to +1234567890
📞 Call 2: Initiated to +1234567891
📞 Call 3: Initiated to +1234567892
...
```

### Minute 5-10: Conversations Happening
```
💬 Turn 1:
   Customer: "Hello?"
   AI: "Hi, this is calling from XYZ company..."

💬 Turn 2:
   Customer: "What do you want?"
   AI: "I'm calling to discuss..."
```

### Minute 10-15: Calls Completing
```
✅ Call 1: Completed (45s, outcome: interested)
✅ Call 2: Completed (32s, outcome: not_interested)
✅ Call 3: Completed (67s, outcome: callback_requested)
```

---

## ⚠️ IMPORTANT NOTES

1. **Real Phone Numbers:** The system will call REAL phone numbers from your contacts. Use test numbers only!

2. **Telnyx Account:** Make sure you have Telnyx SIP configured and funded.

3. **Cost:** Each call costs ~$0.011/minute via Telnyx.

4. **DNC List:** The system automatically respects Do Not Call lists.

5. **Testing Hours:** Be mindful of calling hours (9 AM - 8 PM local time).

---

## 🎉 You're Ready!

Once verification passes and test calls complete successfully:

✅ **Your automated AI call system is PRODUCTION READY!**

You can now:
- Create campaigns
- Upload contacts
- Start automated calling
- Monitor in real-time via Live Monitor
- Review call history and transcripts
- Scale to 1000+ calls/day

**Go to:** https://atsservice.site/

**Navigate to:** Campaigns → Start Queue

**Watch it work!** 🚀

