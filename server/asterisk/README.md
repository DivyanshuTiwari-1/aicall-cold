# AI Dialer AGI Scripts

This directory contains the Asterisk Gateway Interface (AGI) scripts that enable real-time AI conversation during phone calls.

## Files

### Core AGI Scripts

1. **`ai-dialer-agi.php`** - Main call handler
   - Handles outbound AI calls
   - Manages conversation flow
   - Integrates with TTS and STT services
   - Processes caller responses with AI

2. **`ai-dialer-hangup-agi.php`** - Call cleanup
   - Processes call completion
   - Logs final call statistics
   - Updates call status in database
   - Handles error scenarios

3. **`ai-inbound-agi.php`** - Inbound call handler
   - Handles incoming calls
   - Provides basic AI assistance
   - Routes to knowledge base
   - Manages inbound call flow

### Installation

1. **Run the installation script:**
   ```bash
   sudo ./install-agi.sh
   ```

2. **Manual installation:**
   ```bash
   # Copy scripts to Asterisk AGI directory
   sudo cp *.php /var/lib/asterisk/agi-bin/

   # Make executable
   sudo chmod +x /var/lib/asterisk/agi-bin/ai-*.php

   # Set ownership
   sudo chown asterisk:asterisk /var/lib/asterisk/agi-bin/ai-*.php
   ```

3. **Install PHP dependencies:**
   ```bash
   sudo apt-get install php-curl php-json
   ```

## Configuration

### Environment Variables

The AGI scripts use these environment variables:

- `AI_DIALER_URL` - API base URL (default: http://localhost:3000/api/v1)
- `TTS_ENGINE` - TTS engine to use (espeak, google, azure)
- `TTS_LANGUAGE` - Language for TTS (default: en-US)
- `TTS_VOICE` - Voice for TTS (default: en-us)

### Asterisk Configuration

The scripts are referenced in `asterisk-config/extensions.conf`:

```ini
; Main AI dialer context
exten => _X.,1,AGI(ai-dialer-agi.php,${CALL_ID},${CONTACT_PHONE},${CAMPAIGN_ID})

; Call hangup handler
exten => h,1,AGI(ai-dialer-hangup-agi.php,${CALL_ID},${CALL_STATE})

; Inbound call handler
exten => _X.,1,AGI(ai-inbound-agi.php,${CALLER_ID},${CALLER_NAME})
```

## API Endpoints

The AGI scripts communicate with these API endpoints:

### Call Management
- `POST /api/v1/asterisk/call-started` - Call initiation
- `POST /api/v1/asterisk/call-ended` - Call completion
- `POST /api/v1/asterisk/call-completed` - Full call data
- `POST /api/v1/asterisk/call-error` - Error handling

### Audio Processing
- `POST /api/v1/asterisk/tts/generate` - Text-to-speech
- `POST /api/v1/asterisk/speech/transcribe` - Speech-to-text
- `GET /api/v1/asterisk/audio/:filename` - Audio file serving

### Conversation
- `POST /api/v1/conversation/process` - AI conversation processing
- `POST /api/v1/scripts/conversation` - Script-based responses
- `POST /api/v1/knowledge/query` - FAQ lookup

## Call Flow

### Outbound Call Flow

1. **Call Initiation**
   - User clicks "Start Call" in web interface
   - Server creates call record
   - Asterisk originates call via ARI
   - Call routed to `ai-dialer-outbound` context

2. **Call Answered**
   - `ai-dialer-agi.php` executes
   - Gets initial script from campaign
   - Plays greeting via TTS
   - Enters conversation loop

3. **Conversation Loop**
   - Waits for caller response
   - Records audio
   - Converts speech to text
   - Processes with AI conversation engine
   - Plays AI response via TTS
   - Repeats until call ends

4. **Call Completion**
   - `ai-dialer-hangup-agi.php` executes
   - Logs final statistics
   - Updates call status
   - Cleans up resources

### Inbound Call Flow

1. **Call Received**
   - Call routed to `ai-dialer-inbound` context
   - `ai-inbound-agi.php` executes
   - Plays welcome message

2. **Conversation Loop**
   - Records caller questions
   - Queries knowledge base
   - Plays AI responses
   - Continues until caller ends call

## Troubleshooting

### Common Issues

1. **AGI Script Not Found**
   ```
   ERROR: AGI script not found
   ```
   - Check file permissions: `ls -la /var/lib/asterisk/agi-bin/ai-*.php`
   - Ensure scripts are executable: `chmod +x /var/lib/asterisk/agi-bin/ai-*.php`

2. **API Connection Failed**
   ```
   CURL Error: Connection refused
   ```
   - Verify Node.js server is running
   - Check API URL configuration
   - Test API endpoint: `curl http://localhost:3000/api/v1/health`

3. **TTS Generation Failed**
   ```
   Failed to generate TTS audio
   ```
   - Check TTS service configuration
   - Verify audio file permissions
   - Check disk space in /tmp directory

4. **Speech Recognition Failed**
   ```
   No speech detected or transcription failed
   ```
   - Verify audio recording quality
   - Check STT service configuration
   - Test with different audio formats

### Logging

Check Asterisk logs for AGI script output:
```bash
tail -f /var/log/asterisk/full | grep "AI-DIALER"
```

Check Node.js server logs:
```bash
tail -f server/logs/app.log
```

### Testing

Test AGI scripts manually:
```bash
# Test main dialer script
cd /var/lib/asterisk/agi-bin
./ai-dialer-agi.php test-call-id +1234567890 test-campaign-id

# Test hangup script
./ai-dialer-hangup-agi.php test-call-id completed

# Test inbound script
./ai-inbound-agi.php +1234567890 "John Doe"
```

## Security Considerations

1. **File Permissions**
   - AGI scripts should be owned by `asterisk:asterisk`
   - Set appropriate file permissions (755)
   - Restrict access to temporary directories

2. **API Security**
   - AGI endpoints don't require authentication
   - Consider IP whitelisting for production
   - Use HTTPS in production environments

3. **Audio Files**
   - Clean up temporary audio files
   - Set appropriate file size limits
   - Monitor disk usage

## Performance Optimization

1. **TTS Caching**
   - Cache frequently used TTS audio
   - Use CDN for audio file serving
   - Compress audio files

2. **Database Optimization**
   - Index call_events table
   - Use connection pooling
   - Monitor query performance

3. **Resource Management**
   - Limit concurrent calls
   - Monitor memory usage
   - Set appropriate timeouts

## Monitoring

Monitor these metrics:
- Call success rate
- Average call duration
- TTS generation time
- STT accuracy
- API response times
- Error rates

Use tools like:
- Asterisk logs
- Node.js application logs
- Database query logs
- System resource monitoring
