# AI Automated Calls - Node.js Flow (PHP Removed)

## Overview
The automated call system now uses **Node.js FastAGI exclusively** for AI conversations. All PHP AGI scripts have been removed to avoid conflicts and ensure a clean, maintainable codebase.

## Architecture

### Call Flow
```
1. Queue System → Creates call in database
2. Queue System → Calls telephony.startOutboundCall()
3. Asterisk Provider → Originates call via ARI to 'ai-dialer-stasis' app
4. Stasis App → Receives call, sets channel variables (CALL_ID, CONTACT_PHONE, CAMPAIGN_ID)
5. Stasis App → Continues to dialplan context 'ai-dialer-stasis'
6. Dialplan → Executes FastAGI: agi://atsservices:4573
7. FastAGI Server → Routes to AiConversationHandler
8. AI Conversation → Manages complete conversation flow
9. Conversation Turn → Broadcasts via WebSocket to LiveMonitor
10. Call End → Stasis App aggregates transcript and saves to database
```

## Components

### 1. Queue System (`server/services/queue.js`)
- **AutomatedCallQueue** class manages automated call scheduling
- Respects call pacing (30s between calls by default)
- Enforces concurrent call limits (5 by default)
- Checks DNC registry before calling
- Creates call records before initiating
- Broadcasts WebSocket events

### 2. Asterisk Telephony Provider (`server/services/telephony/providers/asterisk.js`)
- Uses ARI to originate calls
- Calls go to 'ai-dialer-stasis' Stasis application
- Passes callId, phoneNumber, campaignId as app arguments

### 3. Stasis App Manager (`server/services/stasis-apps/`)
- **AiDialerStasisApp**: Handles automated AI calls
- Sets channel variables for AGI script
- Continues call to dialplan context
- Handles channel destruction (call end)
- Aggregates transcript from call_events
- Updates call status in database
- Broadcasts WebSocket events

### 4. FastAGI Server (`server/services/agi/agi-server.js`)
- Listens on port 4573 (configurable via AGI_PORT)
- Implements AGI protocol over TCP
- Extracts call parameters from AGI variables
- Routes requests to AiConversationHandler

### 5. AI Conversation Handler (`server/services/agi/ai-conversation-handler.js`)
- Answers call
- Gets initial greeting from conversation engine
- Main conversation loop (up to 20 turns)
- Records customer speech
- Transcribes with STT (Telnyx or fallback)
- Processes with AI conversation engine
- Speaks AI response with TTS
- Logs each conversation turn to database
- Broadcasts conversation turns via WebSocket
- Aggregates transcript on completion
- Handles graceful hangup

### 6. Conversation Engine (`server/routes/conversation.js` or `conversation-simple.js`)
- Analyzes customer intent and emotion
- Generates AI responses based on scripts and knowledge base
- Handles objections intelligently
- Detects DNC requests
- Personalizes responses with contact info
- **Now broadcasts via WebSocket** for real-time display

### 7. Asterisk Dialplan (`asterisk-config/extensions.conf`)
```
[ai-dialer-stasis]
; Main Stasis context for automated AI calls using FastAGI Node.js server
exten => s,1,NoOp(AI Dialer: Starting AI call - Call ID: ${CALL_ID}, Phone: ${CONTACT_PHONE}, Campaign: ${CAMPAIGN_ID})
 same => n,Set(CALL_START_TIME=${EPOCH})
 same => n,Answer()
 same => n,Wait(1)
 ; Use FastAGI Node.js server for AI conversation (not PHP)
 same => n,AGI(agi://atsservices:4573,${CALL_ID},${CONTACT_PHONE},${CAMPAIGN_ID})
 same => n,Hangup()
```

### 8. LiveMonitor Frontend (`client/src/pages/LiveMonitor.js`)
- Subscribes to WebSocket events for organization
- Real-time conversation display in Active Calls section
- Handles both `userInput`/`user_input` and `aiResponse`/`ai_response` fields
- Shows conversation turns with timestamps, emotions, intents
- Highlights latest message
- Auto-scrolls to latest turn
- Visual indicators for AI calls in progress

## WebSocket Events

### Call Started
```json
{
  "type": "call_started",
  "call_id": "uuid",
  "phone_number": "+1234567890",
  "campaign_id": "uuid",
  "timestamp": "2025-10-27T..."
}
```

### Call Status Update
```json
{
  "type": "call_status_update",
  "call_id": "uuid",
  "status": "in_progress",
  "timestamp": "2025-10-27T..."
}
```

### Conversation Turn (NEW - Real-time)
```json
{
  "type": "conversation_turn",
  "call_id": "uuid",
  "user_input": "I'm interested",
  "ai_response": "That's great! Let me tell you more...",
  "turn": 2,
  "emotion": "interested",
  "intent": "positive",
  "confidence": 0.85,
  "timestamp": "2025-10-27T..."
}
```

### Call Ended
```json
{
  "type": "call_ended",
  "call_id": "uuid",
  "outcome": "interested",
  "duration": 120,
  "cost": 0.022,
  "timestamp": "2025-10-27T..."
}
```

## Database Tables

### calls
- Stores call metadata
- `status`: 'initiated' → 'in_progress' → 'completed'
- `outcome`: 'interested', 'not_interested', 'callback', 'dnc_request', etc.
- `transcript`: Full conversation text (aggregated from call_events)
- `duration`: Call duration in seconds
- `cost`: Calculated call cost

### call_events
- Stores individual conversation turns
- `event_type`: 'ai_conversation', 'ai_call_started', 'ai_call_ended', etc.
- `event_data`: JSON with turn details (user_input, ai_response, emotion, intent, etc.)

## Removed Files (PHP Scripts)
- ❌ `server/asterisk/ai-dialer-simplified.php`
- ❌ `server/asterisk/ai-dialer-agi-simple.php`
- ❌ `server/asterisk/ai-dialer-agi.php`
- ❌ `server/asterisk/ai-dialer-hangup-agi.php`
- ❌ `server/asterisk/ai-inbound-agi.php`

## Environment Variables

```bash
# FastAGI Server
AGI_PORT=4573
AGI_HOST=atsservices  # Docker service name

# ARI Connection
ARI_URL=http://asterisk:8088/ari
ARI_USERNAME=ai-dialer
ARI_PASSWORD=ai-dialer-password

# Queue Settings
MAX_CONCURRENT_CALLS=5
CALL_INTERVAL_MS=30000
MAX_RETRY_ATTEMPTS=3

# API Internal URL (for AGI to call back)
API_INTERNAL_URL=http://atsservices:3000
```

## Testing

### Start Queue for Campaign
```bash
# Via API
POST /api/v1/queue/start/:campaignId
Authorization: Bearer <token>
```

### Monitor Live Calls
1. Navigate to **Live Monitor** page
2. View **Active Calls** section
3. Click on an active AI call
4. Watch real-time conversation in **Call Details** panel
5. See conversation turns appear as they happen

### Check Call History
1. Navigate to **Call History** page
2. View completed calls with full transcripts
3. Transcripts are aggregated from conversation turns

## Troubleshooting

### No Conversation Showing in LiveMonitor
- ✅ Check WebSocket connection (green indicator in header)
- ✅ Verify you're subscribed to correct organization
- ✅ Check browser console for WebSocket messages
- ✅ Ensure conversation-simple route is broadcasting

### Calls Not Initiating
- ✅ Check queue is started for campaign
- ✅ Verify phone number assigned to campaign
- ✅ Check daily limit not reached
- ✅ Verify Asterisk ARI connection
- ✅ Check FastAGI server is running on port 4573

### Conversation Not Saving
- ✅ Check call_events table for 'ai_conversation' entries
- ✅ Verify Stasis app is aggregating transcript on call end
- ✅ Check calls table `transcript` field

### FastAGI Connection Issues
- ✅ Verify AGI server started: Check logs for "FastAGI Server listening on 0.0.0.0:4573"
- ✅ Check Asterisk can reach atsservices:4573
- ✅ Verify extensions.conf has correct AGI URL
- ✅ Test with: `telnet atsservices 4573`

## Performance Metrics
- **Call Pacing**: 30 seconds between calls (configurable)
- **Concurrent Calls**: Max 5 simultaneous (configurable)
- **Conversation Turns**: Max 20 turns per call
- **Recording Timeout**: 10 seconds per customer response
- **Cost**: ~$0.011/minute (Telnyx SIP only)

## Next Steps
1. ✅ Configure campaigns with phone numbers
2. ✅ Upload contacts to campaigns
3. ✅ Start queue from campaign dashboard
4. ✅ Monitor calls in LiveMonitor
5. ✅ Review transcripts in Call History
6. ✅ Optimize scripts and knowledge base
