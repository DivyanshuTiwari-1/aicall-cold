# 🤖 AI Automated Calling - Control & Tracking Guide

## Quick Reference

### 🛑 How to Stop Automated Calling

1. **Navigate to Campaigns page** (in your dashboard menu)
2. **Find the running campaign** - it will show a "Stop" button
3. **Click "Stop"** - automated calling will immediately stop
4. The campaign status will change from "Active" to "Paused"

**API Method (if needed):**
```bash
POST /api/calls/automated/stop
Body: { "campaignId": "your-campaign-id" }
```

---

### 📊 How to Track AI Call Conversations

#### Method 1: Call History Page (Main Method)
1. **Navigate to "Call History" page** in your dashboard
2. **Use the "Call Type" filter**:
   - Select "🤖 AI Automated" to see ONLY AI-made calls
   - Select "👤 Manual" to see only human-made calls
   - Leave as "All Calls" to see everything
3. **Look at the "Type" column** - shows 🤖 AI badge for automated calls
4. **Click "View" button** in the Conversation column to see:
   - Full conversation transcript between AI and customer
   - Call duration
   - Emotion detected (interested, frustrated, etc.)
   - CSAT score
   - AI Insights
   - Call outcome

#### Method 2: Campaign Dashboard
1. Go to "Campaigns" page
2. Click on a specific campaign
3. View campaign-level statistics and call outcomes

---

## 🎯 Filter Options for Call History

The Call History page now has these filters:

| Filter | Options | Use Case |
|--------|---------|----------|
| **Call Type** | All / AI Automated / Manual | Find AI vs human calls |
| **Search** | Text input | Search by contact name |
| **Campaign** | Dropdown | Filter by campaign |
| **Outcome** | Scheduled, Fit, Connected, etc. | Find successful calls |
| **Emotion** | Interested, Positive, Neutral, etc. | Find engaged customers |
| **Date Range** | Last 24h, 7d, 30d, 90d | Time-based filtering |

---

## 📋 What You Can See in Each Call

When you click "View" on any AI automated call, you'll see:

### Call Details Summary
- **Duration**: How long the call lasted
- **Outcome**: Result (scheduled, interested, no answer, etc.)
- **Emotion**: Customer's emotional state during call
- **CSAT Score**: Customer satisfaction (1-5 stars)

### Conversation Transcript
- **Chat-style display** showing:
  - 🤖 **AI Agent messages** (green background)
  - 👤 **Customer responses** (blue background)
- Each message timestamped
- Full conversation flow

### AI Insights
- Analysis of the conversation
- Key points discussed
- Recommendations

---

## 🔍 How to Validate System is Working

### Step 1: Check Active Campaigns
```
1. Go to Campaigns page
2. Look for campaigns with "Queue Active" status
3. If a campaign is running, you'll see:
   - "Stop" button (instead of "Start Queue")
   - Active call count
   - Contacts being called
```

### Step 2: Monitor Real-Time Calls
```
1. Go to "Live Monitor" page (if available)
2. Watch calls happening in real-time
3. See:
   - Current active calls
   - Call status (ringing, in-progress, completed)
   - Duration counters
```

### Step 3: Verify Call Records
```
1. Go to "Call History" page
2. Set Call Type filter to "🤖 AI Automated"
3. Check recent calls (Last 24 hours)
4. Click "View" on any call
5. Verify:
   ✅ Transcript exists and is readable
   ✅ Duration is recorded
   ✅ Outcome is set
   ✅ Conversation makes sense
```

### Step 4: Test API Endpoints
```bash
# Get all automated calls from last 7 days
GET /api/calls?callType=automated

# Get specific call details
GET /api/calls/:call_id

# Get call conversation
GET /api/calls/:call_id/conversation

# Check queue status
GET /api/calls/queue/status/:campaignId
```

---

## 🚀 Complete Workflow Example

### Scenario: Running an automated campaign and tracking results

```
1. START AUTOMATED CALLING
   - Go to Campaigns → Select campaign → Click "Start Queue"
   - System begins calling contacts automatically

2. MONITOR PROGRESS
   - Watch "Active Calls" counter increase
   - Check "Live Monitor" for real-time status

3. VIEW RESULTS
   - Go to Call History
   - Filter by Call Type: "🤖 AI Automated"
   - Click "View" on completed calls
   - Read full AI-customer conversations

4. ANALYZE DATA
   - Check emotion distribution
   - Review outcomes (scheduled, interested, etc.)
   - Read AI insights for each call
   - Identify patterns in successful calls

5. STOP WHEN NEEDED
   - Go to Campaigns
   - Click "Stop" on active campaign
   - All automated calling stops immediately
```

---

## 🎨 Visual Indicators

### In Call History Table:

**Automated Call:**
```
[🤖 AI] badge - Purple background
```

**Manual Call:**
```
[👤 Manual] badge - Blue background
```

**Outcome Colors:**
- 🟢 Green: Scheduled, Interested, Fit
- 🟡 Yellow: Callback, Connected
- 🔴 Red: Not Interested, Not Fit
- ⚪ Gray: No Answer, Busy

---

## 📞 What Happens During an Automated Call?

```
1. Queue picks next contact
   ↓
2. System dials customer phone number
   ↓
3. Call connects (or doesn't)
   ↓
4. AI Agent starts conversation
   ↓
5. Each message exchange is logged
   ↓
6. Customer emotion tracked in real-time
   ↓
7. Call ends with outcome
   ↓
8. Transcript saved to database
   ↓
9. Visible in Call History immediately
```

---

## 🔧 Troubleshooting

### Can't see conversations?
- Check if call duration > 0 (means call connected)
- Calls with no answer won't have transcripts
- Click "View" button to load conversation

### Call type showing as "Manual" but it was automated?
- This was a bug in older versions
- Updated system now marks all automated calls correctly
- Automated calls have call_type = 'automated' in database

### Can't stop campaign?
- Ensure you have proper permissions (admin/manager)
- Check if campaign is actually running (shows "Stop" button)
- Try refreshing the page

### No calls showing in history?
- Check date range filter (try "Last 30 days")
- Ensure Call Type filter is not set to wrong value
- Verify campaign has actually made calls

---

## 📊 Database Schema Reference

### Calls Table Fields:
- `call_type`: 'automated' or 'manual'
- `status`: 'initiated', 'in_progress', 'completed', etc.
- `outcome`: 'scheduled', 'interested', 'no_answer', etc.
- `transcript`: Full conversation text
- `emotion`: Customer emotion detected
- `duration`: Call length in seconds
- `csat_score`: Customer satisfaction (1-5)
- `ai_insights`: JSON with AI analysis

---

## 🎯 API Endpoints Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/calls/automated/start` | POST | Start automated calling |
| `/calls/automated/stop` | POST | Stop automated calling |
| `/calls/queue/status/:id` | GET | Check queue status |
| `/calls` | GET | Get call history (supports `callType` filter) |
| `/calls/:id` | GET | Get single call details |
| `/calls/:id/conversation` | GET | Get call conversation transcript |

---

## ✅ Checklist: Verify Everything Works

- [ ] Can start automated calling from Campaigns page
- [ ] Can stop automated calling from Campaigns page
- [ ] Can see active call count updating
- [ ] Can filter Call History by "AI Automated"
- [ ] Can see 🤖 AI badge on automated calls
- [ ] Can click "View" to see conversations
- [ ] Conversations show AI and Customer messages
- [ ] Emotion and outcome are recorded
- [ ] CSAT scores are visible
- [ ] AI Insights are generated
- [ ] Date/time stamps are correct
- [ ] Search and filters work properly

---

## 📚 Additional Resources

- **Live Monitor**: Real-time call monitoring
- **Analytics Dashboard**: Campaign performance metrics
- **Campaign Management**: Create, edit, pause campaigns
- **Contact Management**: Import and manage leads
- **Scripts Management**: Customize AI conversation scripts

---

## 🆘 Support

If you encounter issues:
1. Check browser console for errors (F12)
2. Verify backend is running (check logs)
3. Check database connection
4. Ensure all environment variables are set
5. Review `/server/logs/error.log` for backend errors

---

**Last Updated**: October 2025
**Version**: 2.0 with Call Type Filtering
