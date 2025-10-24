# Quick Test Guide - Automated Calls

## 🚀 Fast Track to Testing

### 1. Prepare Your System (5 minutes)

```bash
# Restart services to apply changes
docker-compose restart server
docker-compose restart asterisk

# Or if not using Docker:
pm2 restart server
systemctl restart asterisk
```

### 2. Create Test Campaign (2 minutes)

1. Login to web UI
2. Go to **Campaigns** page
3. Click **"Create Campaign"**
4. Fill in:
   - Name: "Test Automated Campaign"
   - Type: Sales
   - Status: **Active** (important!)
5. Click **Create**

### 3. Add Test Contacts (3 minutes)

**Option A: Manual Add**
1. Go to **Contacts** page
2. Click **"Add Contact"**
3. Fill in:
   - First Name: Test
   - Last Name: Contact
   - Phone: +1234567890 (use a real number you can call)
   - Campaign: Select "Test Automated Campaign"
4. Click **Save**
5. Add 2-3 more contacts

**Option B: CSV Import**
1. Create CSV file:
```csv
first_name,last_name,phone,email,company
Test,User1,+1234567890,test1@example.com,Test Co
Test,User2,+1987654321,test2@example.com,Test Co
```
2. Go to **Contacts** page
3. Click **"Bulk Import"**
4. Select your campaign
5. Upload CSV
6. Click **Import**

### 4. Prepare Contacts (30 seconds)

1. Stay on **Contacts** page
2. Filter by campaign: Select "Test Automated Campaign"
3. Click **"Prepare for Calling"** button (purple button)
4. Wait for success message: "X contacts prepared for calling"

### 5. Create Script (Optional but Recommended)

1. Go to **Scripts** page
2. Click **"Create Script"**
3. Fill in:
   - Name: "Test Greeting"
   - Type: main_pitch
   - Content: "Hello! This is an AI assistant from Test Company. How are you today?"
4. Click **Create**

### 6. Start Automated Calls! (10 seconds)

1. Go to **Campaigns** page
2. Find "Test Automated Campaign"
3. Look for **"Start Queue"** button (green button with play icon)
4. Click it!
5. You should see:
   - Success toast: "Automated calls started successfully"
   - Button changes to "Stop Queue" (red button)

### 7. Monitor Progress (1-2 minutes)

1. Go to **Calls** page
2. Wait 30-60 seconds
3. You should see:
   - New call records appearing
   - Status: 'initiated' or 'in_progress'
   - After call completes: status changes to 'completed'

### 8. View Conversation (10 seconds)

1. On **Calls** page
2. Find a completed call (status: 'completed', duration > 0)
3. Click **"View"** button
4. Modal opens showing:
   - Call summary (duration, outcome)
   - Full conversation transcript
   - AI and Customer messages in chat format

## ✅ Success Indicators

You'll know it's working when you see:

- ✅ "Start Queue" button visible and clickable
- ✅ Success toast after clicking button
- ✅ Button changes to "Stop Queue"
- ✅ Call records appear in Calls page (within 60 seconds)
- ✅ Call status progresses: initiated → in_progress → completed
- ✅ Can click "View" on completed calls
- ✅ Transcript shows conversation between AI and Customer

## ❌ Quick Fixes for Common Issues

### Button is Disabled
**Problem:** Can't click "Start Queue"
**Fix:**
```bash
# Check campaign status
# Campaign must be 'active' AND have contacts
# Go to Campaigns page, verify status column shows "active"
# Verify Contacts column shows a number > 0
```

### Button Enabled But No Calls
**Problem:** Button works but calls don't appear
**Check:**
1. Browser console for errors
2. Server logs:
```bash
docker logs aicall-server -f
# Look for: "Found X contacts ready for calling"
# Should see contact selection messages
```

### Calls Appear But No Transcript
**Problem:** Calls complete but "View" shows empty
**Check:**
1. AGI script execution:
```bash
docker exec -it aicall-asterisk ls -la /var/lib/asterisk/agi-bin/
# Files should be executable (-rwxr-xr-x)
```

2. Make executable if needed:
```bash
docker exec -it aicall-asterisk chmod +x /var/lib/asterisk/agi-bin/*.php
```

3. Check AGI logs:
```bash
docker logs aicall-asterisk -f | grep "AI-DIALER-AGI"
```

## 🔍 Debugging Commands

```bash
# Check if server is receiving requests
docker logs aicall-server -f | grep "automated/start"

# Check queue processing
docker logs aicall-server -f | grep "Selected contact"

# Check AGI script execution
docker logs aicall-asterisk -f | grep "AGI"

# Check database for contact statuses
docker exec -it aicall-postgres psql -U aicall -d aicall -c "SELECT status, COUNT(*) FROM contacts GROUP BY status;"

# Check active queues
docker logs aicall-server -f | grep "Queue"
```

## 📊 Expected Log Output

### When Starting Queue
```
[Server] Found 3 contacts ready for calling in campaign abc-123
[Server] Automated calls started for campaign: abc-123
[Server] Selected contact xyz-456 (+1234567890) for calling - status: pending
[Server] ✅ Automated call initiated for Test User1 (+1234567890)
```

### When AGI Runs
```
[Asterisk] AI-DIALER-AGI: Starting AI call - Call ID: auto_123, Phone: +1234567890
[Asterisk] AI-DIALER-AGI: API Request: http://host.docker.internal:3000/api/v1/scripts/conversation
[Asterisk] AI-DIALER-AGI: API Success for /scripts/conversation: HTTP 200
[Asterisk] AI-DIALER-AGI: Playing initial script: Hello! This is an AI assistant...
```

### When Call Ends
```
[Server] Call ended - ID: auto_123, Turns: 5
[Server] ✅ Call auto_123 completed - Duration: 45s, Cost: $0.0083, Outcome: interested
```

## 🎯 Test Scenarios

### Scenario 1: Basic Test (Recommended First Test)
- 1 campaign, 2-3 contacts
- Simple greeting script
- Expected result: 2-3 calls completed with transcripts

### Scenario 2: Multiple Contacts
- 1 campaign, 10+ contacts
- Watch queue process them sequentially
- Expected result: Calls processed one by one with 30-second intervals

### Scenario 3: Stop and Restart
- Start queue
- Wait for 1-2 calls to complete
- Click "Stop Queue"
- Wait 1 minute
- Click "Start Queue" again
- Expected result: Queue resumes with remaining contacts

## 💡 Pro Tips

1. **Use Test Phone Numbers**: Use your own phone or a test number first
2. **Check Everything**: Browser console + server logs + asterisk logs
3. **Small Batches**: Test with 2-3 contacts first, then scale up
4. **Monitor Costs**: Each call costs money through Telnyx
5. **DNC List**: Add your personal numbers to DNC list to avoid accidents

## 📞 Quick Contact Status Check

Go to PostgreSQL and run:
```sql
SELECT
  c.name as campaign,
  ct.status,
  COUNT(*) as count
FROM contacts ct
JOIN campaigns c ON ct.campaign_id = c.id
GROUP BY c.name, ct.status
ORDER BY c.name, ct.status;
```

Should show something like:
```
    campaign          | status  | count
----------------------+---------+-------
Test Automated Campaign | pending |     3
```

## ✨ You're Ready!

If you can:
1. ✅ Click "Start Queue" button
2. ✅ See calls appearing in Calls page
3. ✅ View conversation transcripts

**Congratulations! Your automated calling system is working! 🎉**

---

Need help? Check:
- AUTOMATED_CALLS_IMPLEMENTATION_SUMMARY.md (detailed technical info)
- Server logs (most helpful for troubleshooting)
- Browser console (for frontend issues)
