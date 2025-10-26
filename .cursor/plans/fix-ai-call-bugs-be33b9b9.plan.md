<!-- be33b9b9-3ec1-4193-a5fe-8a3d4546f4ba f92cf8db-1c48-46b9-b193-f729b65f21fd -->
# Fix Critical Bugs in AI Automated Calling System

## Critical Bugs Identified

### 1. Validation Bug in Start Automated Calls (HIGH PRIORITY)

**File:** `server/routes/calls.js` Line 716

**Bug:** Missing function call syntax

```javascript
const { error, value } = automatedCallSchema.validate;
```

**Should be:**

```javascript
const { error, value } = automatedCallSchema.validate(req.body);
```

**Impact:** Validation always fails, automated calls never start

---

### 2. Missing Asterisk Simplified Routes Registration (HIGH PRIORITY)

**File:** `server/index.js`

**Bug:** The simplified asterisk routes (`server/routes/asterisk-simplified.js`) are never registered in the Express app.

**Impact:**

- TTS generation fails (no `/api/v1/asterisk/tts/generate` endpoint)
- STT transcription fails (no `/api/v1/asterisk/speech/transcribe` endpoint)
- AI cannot speak or listen to customers

**Fix needed:** Add route registration in server/index.js:

```javascript
app.use('/api/v1/asterisk', require('./routes/asterisk-simplified'));
```

---

### 3. AI Conversation Events Not Being Saved (MEDIUM PRIORITY)

**File:** `server/routes/conversation-simple.js` Lines 71-79, 152-161

**Bug:** Call events are saved but the PHP script (`ai-dialer-simplified.php`) calls the endpoint and receives responses, but doesn't create proper call event records with conversation turns.

**Issue:** The `conversation_turn` and `ai_response` events are saved, but there's no `ai_conversation` event type that the call completion logic looks for when building transcripts.

**Fix:** Change event type from `conversation_turn` and `ai_response` to `ai_conversation` to match what the call completion logic expects (see `server/services/stasis-apps/ai-dialer-app.js` line 145).

---

### 4. Queue Auto-Start Missing Phone Number (MEDIUM PRIORITY)

**File:** `server/services/queue.js` Lines 373-392

**Bug:** Cron job auto-starts queues without phoneNumberId:

```javascript
await callQueue.startQueue(null, campaign.id);
```

But `startQueue` requires phoneNumberId to make calls. This causes auto-restarted queues to fail.

**Fix:** Either:

- Get default phone number for campaign before starting
- Don't auto-restart queues (let user manually start)

---

### 5. Call History Not Showing Transcripts for Simplified Calls (LOW PRIORITY)

**File:** `server/routes/conversation-simple.js`

**Issue:** When simplified automated calls complete, transcripts aren't properly aggregated because:

1. Event types don't match (`conversation_turn` vs `ai_conversation`)
2. The data structure saved doesn't include both `user_input` and `ai_response` in same event

**Fix:** Consolidate conversation data into single event type with both customer input and AI response.

---

### 6. Missing Error Handling in Queue Stop (LOW PRIORITY)

**File:** `server/routes/calls.js` Lines 849-889

**Bug:** Stop endpoint validates with `automatedCallSchema` which requires both `campaignId` AND `phoneNumberId`, but stop only needs `campaignId`.

**Fix:** Create separate validation schema for stop that only requires campaignId:

```javascript
const stopCallSchema = Joi.object({
    campaignId: Joi.string().uuid().required()
});
```

---

### 7. Calls Table Missing Required Columns (CRITICAL)

**Issue:** Queue creates calls with `from_number` column, but calls table schema only has `twilio_call_sid` and standard fields.

**Check:** Verify `calls` table has:

- `from_number` VARCHAR
- `to_number` VARCHAR
- `call_type` ENUM('automated', 'manual')

If missing, migration needed.

---

## Priority Fix Order

1. **IMMEDIATE (Blocking AI calls):**

   - Fix validation bug in calls.js line 716
   - Register asterisk-simplified routes in index.js
   - Verify calls table has required columns

2. **HIGH (Prevents proper operation):**

   - Fix event types in conversation-simple.js
   - Fix queue auto-start to include phone numbers

3. **MEDIUM (Improves reliability):**

   - Fix stop endpoint validation
   - Add better error handling

4. **LOW (Nice to have):**

   - Improve transcript aggregation
   - Add more logging

---

## Testing After Fixes

1. Start automated calling queue from dashboard
2. Verify call initiates to customer
3. Check logs for TTS/STT endpoints being called
4. Verify conversation events saved to database
5. Check call history shows completed calls with transcripts
6. Test stopping queue works properly

### To-dos

- [ ] Fix automatedCallSchema.validate missing parentheses in calls.js line 716
- [ ] Register asterisk-simplified routes in server/index.js
- [ ] Check and update calls table schema for from_number, to_number columns
- [ ] Change conversation event types to ai_conversation in conversation-simple.js
- [ ] Fix queue auto-start to get default phone number or disable auto-restart
- [ ] Create separate validation schema for stop endpoint
- [ ] Test complete automated call flow from start to call history