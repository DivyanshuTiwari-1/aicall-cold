# How to View Call Conversations

## Overview
After a call is completed, you can view the full conversation transcript between the AI and the customer. The system automatically saves all conversation turns and builds a complete transcript.

## Where to Find Call Conversations

### 1. **Calls Page**
Navigate to **Calls** in the sidebar menu to see all your call history.

### 2. **View Conversation**
In the calls table, you'll see a "Conversation" column on the right with a **View** button for each call.

- **"View"** - Appears for calls that have a conversation transcript
- **"Details"** - Appears for calls without a transcript (e.g., no answer, busy)

### 3. **Conversation Modal**
Click the **View** button to open a beautiful conversation modal that shows:

#### Call Summary (Top Section)
- **Duration**: How long the call lasted
- **Outcome**: Result of the call (interested, scheduled, no answer, etc.)
- **Emotion**: Detected emotion (interested, positive, neutral, frustrated, etc.)
- **CSAT Score**: Customer satisfaction rating (if available)

#### Conversation Chat View
The conversation is displayed in a **chat-style interface** with:
- **Customer messages** - Shown on the right in blue bubbles with a user icon
- **AI messages** - Shown on the left in white bubbles with "AI" label
- **Timestamps** - When each message was sent (if available)

#### Additional Information
- **AI Insights**: Analysis and insights from the AI
- **Notes**: Any notes added during or after the call
- **Call Date**: When the call took place

## How It Works Technically

### Backend Process
1. **During the call**: Each conversation turn is saved to the `call_events` table with type `ai_conversation`
2. **When call ends**: The AGI script notifies the server via `/asterisk/call-ended` endpoint
3. **Transcript generation**: The system retrieves all conversation events and builds a formatted transcript:
   ```
   Customer: Hello, who is this?
   AI: Hi! This is an AI assistant calling from [Company Name]...
   Customer: I'm interested, tell me more.
   AI: I'd be happy to! Our solution helps...
   ```
4. **Storage**: The transcript is saved to the `calls` table in the `transcript` field

### Frontend Display
1. The `CallConversationModal` component fetches:
   - Call details from `/api/v1/calls/:id`
   - Conversation history from `/api/v1/calls/:id/conversation`
2. The conversation history is displayed in chronological order with alternating colors
3. If structured conversation data exists, it's shown as chat bubbles
4. If only a raw transcript exists, it's shown as formatted text

## Troubleshooting

### No Conversation Showing
If you don't see a conversation for a completed call:

1. **Check call duration**: Calls with 0 duration (no answer, busy) won't have conversations
2. **Check call events**: Verify that conversation events are being logged in `call_events` table
3. **Check AGI script**: Ensure the AGI script is processing conversations and calling `/conversation/process`

### Incomplete Transcript
If the transcript seems incomplete:

1. **Check max turns**: The AGI script has a limit of 20 conversation turns by default
2. **Check conversation logs**: Look at server logs for any conversation processing errors
3. **Check speech-to-text**: Ensure the speech transcription service is working

### API Errors
If you get errors when viewing conversations:

1. **Check authentication**: Ensure you're logged in with proper permissions
2. **Check call ownership**: You can only view calls from your organization
3. **Check database**: Ensure the calls and call_events tables exist and have data

## Features

### Current Features
- ✅ Real-time conversation logging during calls
- ✅ Automatic transcript generation
- ✅ Beautiful chat-style UI
- ✅ Emotion and intent analysis
- ✅ Call summary with key metrics
- ✅ Full conversation history access

### Coming Soon
- 📅 Sentiment timeline graph
- 📅 Key moments highlighting
- 📅 Downloadable transcripts (PDF, TXT)
- 📅 Search within conversations
- 📅 AI-generated call summaries
- 📅 Action items extraction

## Example Conversation View

```
┌─────────────────────────────────────────────────┐
│  📞 Call Conversation                           │
│  John Smith                                      │
├─────────────────────────────────────────────────┤
│  Duration: 3:24  Outcome: Interested            │
│  Emotion: Positive  CSAT: 4/5                   │
├─────────────────────────────────────────────────┤
│                                                  │
│  ┌──────────────────────┐                      │
│  │ AI: Hello John! This │                      │
│  │ is calling from...   │                      │
│  └──────────────────────┘                      │
│                                                  │
│               ┌─────────────────────────┐      │
│               │ Customer: Hi, who is    │      │
│               │ this?                   │      │
│               └─────────────────────────┘      │
│                                                  │
│  ┌──────────────────────┐                      │
│  │ AI: I'm calling to   │                      │
│  │ share information... │                      │
│  └──────────────────────┘                      │
│                                                  │
└─────────────────────────────────────────────────┘
```

## Notes
- Conversations are stored securely and only accessible to users in your organization
- All conversation data is encrypted at rest
- Transcripts are automatically generated - no manual intervention needed
- The system supports multiple languages for speech-to-text (configure in `.env`)
