# Automated Calls Live Monitoring - Testing Guide

## Quick Start Testing

### Prerequisites
- Server and client running
- Database with at least one campaign
- At least one contact assigned to campaign
- A script created for the campaign

### Step-by-Step Test

#### 1. Start an Automated Call Campaign
```bash
# Navigate to the app
http://localhost:3001/campaigns

# Click on a campaign
# Click "Start Queue" button
# You should see: "Automated calls started successfully"
```

#### 2. View Live Monitor
```bash
# Navigate to Live Monitor
http://localhost:3001/live-monitor

# You should see:
✅ Active calls count showing 1+
✅ "AI Calls" metric showing automated calls
✅ Call cards with 🤖 AUTO badge
✅ Purple-colored automated call indicators
```

#### 3. Check Conversation Display
```bash
# Click on an automated call card

# Right panel should show:
✅ Call details (name, phone, duration)
✅ "Live" indicator with animated pulse
✅ Turn counter badge (e.g., "3 turns")
✅ Conversation section with messages
✅ Speaker labels: 👤 Customer / 🤖 AI Agent
✅ Turn numbers (#1, #2, #3, etc.)
✅ Latest message highlighted with colored ring
✅ Emotion badges if detected
✅ Confidence scores on AI messages
```

#### 4. Test Real-Time Updates
```bash
# Leave the Live Monitor page open
# Wait 5 seconds

# You should observe:
✅ Conversation updates automatically
✅ New turns appear without refresh
✅ Auto-scrolls to latest message
✅ Turn counter increments
✅ Duration timer updates
```

#### 5. Check Conversation Preview on Cards
```bash
# Look at the call card itself

# Should show:
✅ Purple box with conversation preview
✅ "Latest: X turns" text
✅ Snippet of last message
✅ Emotion badge if available
✅ "AI in conversation..." with animated pulse
```

## Detailed Testing Checklist

### Live Monitor Page Load
- [ ] Page loads without errors
- [ ] Metrics show correct counts
- [ ] Active calls list appears
- [ ] No console errors in browser

### Automated Call Detection
- [ ] Automated calls show 🤖 AUTO badge
- [ ] Manual calls don't have AUTO badge
- [ ] Metrics correctly split Auto vs Manual
- [ ] Call type displays as "AI Agent"

### Conversation Context Endpoint
Test directly:
```bash
# Get a call ID from database
curl http://localhost:3000/api/v1/conversation/context/YOUR_CALL_ID

# Should return:
{
  "success": true,
  "history": [...]
}
```

### Live Calls Endpoint
Test directly:
```bash
curl http://localhost:3000/api/v1/analytics/live-calls \
  -H "Authorization: Bearer YOUR_TOKEN"

# Should return calls with conversation data:
{
  "success": true,
  "liveCalls": [
    {
      "id": "...",
      "automated": true,
      "conversation": {
        "lastMessage": "...",
        "turnCount": 3,
        "lastEmotion": "neutral"
      }
    }
  ]
}
```

### Conversation Display Features
- [ ] Customer messages: Blue background, left-aligned
- [ ] AI messages: Purple background, right-aligned
- [ ] Turn numbers visible (#1, #2, etc.)
- [ ] Latest message has colored ring
- [ ] Timestamps formatted correctly
- [ ] Emotion badges colored correctly
- [ ] Confidence percentages display
- [ ] Auto-scroll works on update

### Polling Behavior
- [ ] Polling activates when call selected
- [ ] Only polls if call is automated
- [ ] Only polls if status is 'in_progress'
- [ ] Stops polling when call completes
- [ ] Browser network tab shows requests every 5s
- [ ] No excessive requests when not needed

### Call Card Features
- [ ] Conversation preview appears for automated calls
- [ ] Turn count updates in real-time
- [ ] Latest message snippet shows
- [ ] Emotion badge displays correctly
- [ ] Animated pulse indicator visible
- [ ] "AI in conversation..." text shows

### Edge Cases
- [ ] No errors when call has no conversation
- [ ] Handles empty conversation gracefully
- [ ] Works with multiple simultaneous calls
- [ ] Completed calls still show conversation
- [ ] Failed calls don't break display
- [ ] Very long messages truncate properly

## Common Issues & Solutions

### Issue: "No conversation transcript available"
**Cause:** AGI script not logging to call_events table
**Fix:**
1. Check AGI script is executing (check Asterisk logs)
2. Verify API calls to `/asterisk/call-event` succeed
3. Check database: `SELECT * FROM call_events WHERE event_type='ai_conversation'`

### Issue: Automated calls not appearing
**Cause:** Database field mismatch
**Fix:** Verify calls have `call_type='automated'`:
```sql
SELECT id, call_type, status FROM calls WHERE status IN ('initiated', 'in_progress');
```

### Issue: Conversation not updating
**Cause:** Polling not active or call not in progress
**Fix:**
1. Check call status is 'in_progress'
2. Open browser dev tools → Network tab
3. Look for requests to `/conversation/context/...` every 5s
4. Verify no 404 or 500 errors

### Issue: Messages showing in wrong order
**Cause:** Timestamp sorting issue
**Fix:** Check conversation endpoint sorts by timestamp ASC

## Database Queries for Debugging

### Check active automated calls:
```sql
SELECT
  id,
  contact_id,
  status,
  call_type,
  CASE WHEN call_type = 'automated' THEN true ELSE false END as is_automated,
  created_at
FROM calls
WHERE status IN ('initiated', 'in_progress')
  AND call_type = 'automated'
ORDER BY created_at DESC;
```

### Check conversation events:
```sql
SELECT
  call_id,
  event_type,
  event_data->>'user_input' as user_input,
  event_data->>'ai_response' as ai_response,
  event_data->>'emotion' as emotion,
  timestamp
FROM call_events
WHERE event_type = 'ai_conversation'
  AND call_id = 'YOUR_CALL_ID'
ORDER BY timestamp ASC;
```

### Count conversation turns:
```sql
SELECT
  call_id,
  COUNT(*) as turn_count
FROM call_events
WHERE event_type = 'ai_conversation'
GROUP BY call_id
ORDER BY turn_count DESC;
```

## Performance Testing

### Monitor Query Performance
```sql
EXPLAIN ANALYZE
SELECT DISTINCT ON (call_id)
  call_id,
  event_data,
  timestamp
FROM call_events
WHERE call_id IN (SELECT id FROM calls WHERE status = 'in_progress')
  AND event_type = 'ai_conversation'
ORDER BY call_id, timestamp DESC;
```

### Check Polling Load
1. Open multiple browser tabs with Live Monitor
2. Select different automated calls in each
3. Monitor server logs for query count
4. Check database connection count
5. Verify response times stay under 500ms

## Success Criteria

✅ All automated calls appear in Live Monitor
✅ Conversation updates every 5 seconds
✅ Turn-by-turn conversation visible
✅ Speaker labels clear and correct
✅ Latest message always highlighted
✅ Auto-scroll works smoothly
✅ Emotion/confidence display correctly
✅ No console errors
✅ No excessive API calls
✅ Works with multiple simultaneous calls

## Next Steps After Testing

If all tests pass:
1. Test with real phone calls (not just simulated)
2. Monitor for 24 hours with production load
3. Gather user feedback on UI/UX
4. Consider adding WebSocket for instant updates
5. Add conversation export feature

## Reporting Issues

If you find bugs, include:
- Call ID
- Browser console errors
- Network tab requests/responses
- Database state (queries above)
- Screenshots of Live Monitor
- Server logs around the time of issue

## Support

For questions or issues:
1. Check server logs: `server/logs/app.log`
2. Check Asterisk logs: `asterisk-logs/`
3. Review implementation docs: `AUTOMATED_CALLS_LIVE_MONITORING_IMPLEMENTATION.md`
4. Check original fix summary: `AUTOMATED_CALLS_FIX_SUMMARY.md`
