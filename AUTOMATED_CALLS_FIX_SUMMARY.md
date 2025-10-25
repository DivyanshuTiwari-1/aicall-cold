# Automated Calls System Fix Summary

## Problem
Automated calls were starting successfully (returning `campaignId`), but:
1. **No call conversations were visible** - Users couldn't see what the AI said or what responses were received
2. **AI wasn't using scripts** - The system wasn't reading and using the configured scripts for campaigns
3. **Conversation tracking wasn't working** - Call details and transcripts weren't being stored properly

## Root Causes Identified

### 1. Script API Response Format Mismatch
**Location:** `server/routes/scripts.js` - GET `/api/v1/scripts/conversation`

**Issue:** The AGI script expected a response with `main_script` field directly, but the endpoint was returning:
```json
{
  "success": true,
  "data": {
    "call": {...},
    "script": {...}
  }
}
```

The AGI script was looking for `response['main_script']` which didn't exist.

### 2. AGI Script Not Properly Handling Script Content
**Location:** `server/asterisk/ai-dialer-agi-simple.php`

**Issue:**
- The script wasn't properly extracting the script content from the API response
- Conversation events weren't being logged consistently
- User inputs and AI responses weren't being tracked for transcript building

### 3. Stasis App Not Passing Arguments to Dialplan
**Location:** `server/services/stasis-apps/ai-dialer-app.js`

**Issue:** When the call was originated via Asterisk ARI, the Stasis app tried to continue to the dialplan but didn't properly pass the call arguments (callId, phone, campaignId) to the AGI script.

### 4. Dialplan Using Wrong Variables
**Location:** `asterisk-config/extensions.conf`

**Issue:** The dialplan context `[ai-dialer-stasis]` was trying to use `${ARG1}`, `${ARG2}`, etc., but these variables weren't available when coming from Stasis.

## Fixes Applied

### Fix 1: Updated Script API Endpoint
**File:** `server/routes/scripts.js` (lines 480-580)

**Changes:**
- Modified GET `/scripts/conversation` to return **both** old and new formats for compatibility
- Added `main_script` field directly in response for AGI scripts
- Added script personalization with contact variables (`{first_name}`, `{company}`, etc.)
- Enhanced response with contact information

**Result:** AGI scripts can now properly retrieve and use campaign scripts.

### Fix 2: Enhanced AGI Script Conversation Tracking
**File:** `server/asterisk/ai-dialer-agi-simple.php`

**Changes:**
- Added comprehensive logging for script retrieval (lines 217-233)
- Added conversation event logging for ALL interactions:
  - Initial greeting/script (lines 240-249)
  - User inputs (lines 275-285)
  - AI responses (automatically logged via `/conversation/process`)
  - Fallback responses (lines 328-339)
  - No input events (lines 346-357)
- Improved error handling with detailed logging

**Result:** Complete conversation history is now tracked and visible.

### Fix 3: Fixed Stasis App Argument Passing
**File:** `server/services/stasis-apps/ai-dialer-app.js` (lines 69-111)

**Changes:**
- Set channel variables explicitly using `setChannelVar()`:
  - `CALL_ID`
  - `CONTACT_PHONE`
  - `CAMPAIGN_ID`
- Changed dialplan continuation to use `ai-dialer-stasis` context with extension `s`
- Added detailed logging for debugging

**Result:** AGI scripts now receive the correct call information.

### Fix 4: Updated Asterisk Dialplan
**File:** `asterisk-config/extensions.conf` (lines 104-113)

**Changes:**
- Changed from `${ARG1}`, `${ARG2}`, `${ARG3}` to channel variables:
  - `${CALL_ID}`
  - `${CONTACT_PHONE}`
  - `${CAMPAIGN_ID}`
- Updated to use `ai-dialer-agi-simple.php` (the correct AGI script)
- Added hangup handler for proper cleanup

**Result:** AGI script is invoked with correct arguments.

## How Automated Calls Work Now

### Complete Flow:

1. **User Starts Queue**
   - Frontend calls `/api/v1/calls/automated/start` with `campaignId`
   - Server validates campaign and starts queue

2. **Queue Processes Contacts**
   - `server/services/queue.js` - `AutomatedCallQueue` class
   - Selects next contact from campaign (not on DNC, within retry limits)
   - Creates call record in database with status='initiated'

3. **Telephony Initiation**
   - Calls `server/services/telephony.js` - `startOutboundCall()`
   - Uses Asterisk provider: `server/services/telephony/providers/asterisk.js`
   - Originates call via ARI with:
     - `app: 'ai-dialer-stasis'`
     - `appArgs: [callId, toPhone, campaignId]`

4. **Stasis App Handles Call**
   - `server/services/stasis-apps/ai-dialer-app.js` receives StasisStart event
   - Answers the channel
   - Sets channel variables (CALL_ID, CONTACT_PHONE, CAMPAIGN_ID)
   - Continues to dialplan context `[ai-dialer-stasis]`

5. **Asterisk Dialplan Executes AGI**
   - `asterisk-config/extensions.conf` - `[ai-dialer-stasis]` context
   - Runs `AGI(ai-dialer-agi-simple.php, ${CALL_ID}, ${CONTACT_PHONE}, ${CAMPAIGN_ID})`

6. **AGI Script Runs Conversation**
   - `server/asterisk/ai-dialer-agi-simple.php`
   - **Fetches script:** GET `/api/v1/scripts/conversation?call_id=...`
   - **Gets personalized script** with contact name, company, etc.
   - **Plays greeting via TTS**
   - **Conversation loop:**
     - Records user response
     - Transcribes speech to text (via `/api/v1/asterisk/speech/transcribe`)
     - Processes with AI (via `/api/v1/conversation/process`)
     - Gets AI response based on:
       - Campaign scripts
       - Knowledge base
       - Intent and emotion analysis
     - Plays AI response via TTS
     - Logs everything to `call_events` table
   - **Ends call** when:
     - Max turns reached
     - Low confidence responses
     - User requests DNC
     - Conversation completes naturally

7. **Conversation Tracked in Database**
   - All interactions logged to `call_events` table with `event_type='ai_conversation'`
   - Each event contains:
     - `user_input` - What the caller said
     - `ai_response` - What the AI replied
     - `turn` - Conversation turn number
     - `timestamp` - When it occurred
     - `confidence`, `intent`, `emotion` - AI analysis

8. **Call Completion**
   - AGI notifies server: POST `/api/v1/asterisk/call-ended`
   - Server aggregates transcript from all `ai_conversation` events
   - Updates call record with:
     - `status='completed'`
     - `outcome` (completed, no_answer, interested, etc.)
     - `duration`
     - `cost`
     - `transcript` (full conversation text)
   - Updates contact status

9. **Viewing Conversations**
   - Frontend calls GET `/api/v1/calls/:id/conversation`
   - Returns:
     - Call details (duration, status, outcome)
     - `conversationHistory` - Array of all conversation turns
     - Available scripts used

## What The AI Can Do Now

### Script-Based Conversations
- ✅ Uses campaign-specific scripts
- ✅ Personalizes with contact info (name, company, title)
- ✅ Supports script variables: `{first_name}`, `{last_name}`, `{company}`, `{title}`

### Intelligent Responses
- ✅ Processes user input through conversation engine
- ✅ Uses knowledge base for FAQ answers
- ✅ Detects intent (objection, buying signal, information request)
- ✅ Analyzes emotion (positive, negative, frustrated, confused)
- ✅ Handles objections (price, timing, competitor)

### Conversation Management
- ✅ Tracks full conversation history
- ✅ Builds complete transcript
- ✅ Knows when to transfer to human (low confidence, frustrated user)
- ✅ Handles DNC requests automatically
- ✅ Suggests actions (schedule meeting, send info, end call)

## Testing the Fix

### To Test Automated Calls:

1. **Create a Script:**
   ```
   POST /api/v1/scripts
   {
     "name": "Sales Pitch",
     "type": "main_pitch",
     "content": "Hi {first_name}, this is Alex calling from {company}. How are you today? I'm reaching out because..."
   }
   ```

2. **Create a Campaign and assign the script:**
   ```
   POST /api/v1/campaigns
   {
     "name": "Q1 Outreach",
     "type": "sales",
     "script_id": "<script-id>",
     "status": "active"
   }
   ```

3. **Add Contacts to Campaign**

4. **Start Automated Calls:**
   ```
   POST /api/v1/calls/automated/start
   {
     "campaignId": "<campaign-id>"
   }
   ```

5. **View Call Details:**
   ```
   GET /api/v1/calls/<call-id>
   GET /api/v1/calls/<call-id>/conversation
   ```

### What You Should See:

- ✅ Call record with status 'initiated' → 'in_progress' → 'completed'
- ✅ Conversation history showing:
  - AI greeting (using your script with contact name)
  - User responses
  - AI replies
  - Turn numbers
  - Timestamps
- ✅ Complete transcript in call record
- ✅ Proper outcome classification
- ✅ Cost calculation based on duration

## Files Modified

1. ✅ `server/routes/scripts.js` - Fixed script API response format
2. ✅ `server/asterisk/ai-dialer-agi-simple.php` - Enhanced conversation tracking
3. ✅ `server/services/stasis-apps/ai-dialer-app.js` - Fixed argument passing
4. ✅ `asterisk-config/extensions.conf` - Updated dialplan variables

## Environment Variables Needed

Make sure these are set in `.env`:

```env
# Asterisk ARI
ARI_URL=http://localhost:8088/ari
ARI_USERNAME=ai-dialer
ARI_PASSWORD=ai-dialer-password

# Telnyx
TELNYX_API_KEY=your_telnyx_api_key
TELNYX_DID=+15555551234
TELNYX_SIP_USERNAME=your_sip_username
TELNYX_SIP_PASSWORD=your_sip_password

# AI Dialer
AI_DIALER_URL=http://host.docker.internal:3000/api/v1
MAX_CONCURRENT_CALLS=5
CALL_INTERVAL_MS=30000
```

## Next Steps

1. **Test with real phone call** - Call the system and verify:
   - AI speaks the script
   - Your responses are heard and processed
   - Conversation is tracked properly

2. **Check logs** for debugging:
   - Asterisk logs: `asterisk-logs/` directory
   - Server logs: `server/logs/app.log`
   - AGI script logs in Asterisk console

3. **Monitor active calls:**
   ```
   GET /api/v1/queue/status/<campaignId>
   ```

4. **View call history:**
   ```
   GET /api/v1/calls?status=completed&campaignId=<id>
   ```

## Troubleshooting

If calls still don't show conversations:

1. Check that Asterisk is running: `docker ps`
2. Check ARI connection: `GET /api/v1/health`
3. Check AGI script is executable: `chmod +x server/asterisk/ai-dialer-agi-simple.php`
4. Check PHP is installed in Asterisk container: `docker exec asterisk php --version`
5. Check Asterisk logs: `docker exec asterisk asterisk -rx "agi show"`
6. Test API endpoints manually:
   ```bash
   curl "http://localhost:3000/api/v1/scripts/conversation?call_id=test_123"
   ```

## Summary

The automated calls system now:
- ✅ **Uses campaign scripts** properly with personalization
- ✅ **Tracks all conversations** with full detail
- ✅ **Displays conversation history** in the frontend
- ✅ **Builds complete transcripts** automatically
- ✅ **Handles all conversation types** (greetings, responses, errors, no input)
- ✅ **Integrates with knowledge base** for intelligent responses
- ✅ **Detects intent and emotion** for better conversations
- ✅ **Manages DNC requests** automatically

Your AI agents can now have real conversations with leads based on your scripts! 🎉
