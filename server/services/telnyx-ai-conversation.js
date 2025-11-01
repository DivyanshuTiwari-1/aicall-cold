const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const { query } = require('../config/database');
const logger = require('../utils/logger');
const telnyxCallControl = require('./telnyx-call-control');
const WebSocketBroadcaster = require('./websocket-broadcaster');

/**
 * Telnyx AI Conversation Orchestrator
 * Simplified replacement for ai-conversation-handler.js
 * Handles AI conversations using Telnyx webhooks + existing Piper TTS + Vosk STT
 */

class TelnyxAIConversation {
    constructor() {
        // Use API_INTERNAL_URL for internal service-to-service calls (Docker network)
        // Fallback to API_URL if not set (for same-container calls)
        this.apiBaseUrl = process.env.API_INTERNAL_URL || process.env.API_URL || 'http://localhost:3000';

        // Log configuration
        logger.info(`🔧 [AI-CONVERSATION] Initialized with API URL: ${this.apiBaseUrl}`);

        this.conversationStates = new Map(); // callId -> state
        this.maxTurns = 20;
    }

    /**
     * Handle call answered - start AI conversation
     */
    async handleCallAnswered(callControlId, metadata) {
        const { callId, campaignId, organizationId, contactId, scriptId } = metadata;

        try {
            logger.info(`🤖 [AI-CONVERSATION] Call answered: ${callId}`);
            logger.info(`   Starting AI conversation...`);
            logger.info(`   Contact ID: ${contactId}`);
            logger.info(`   Campaign ID: ${campaignId}`);
            logger.info(`   Script ID: ${scriptId || 'none'}`);

            // Get contact details for script personalization
            const contactResult = await query(`
                SELECT first_name, last_name, company, title, phone
                FROM contacts
                WHERE id = $1
            `, [contactId]);

            const contact = contactResult.rows[0] || {};

            // Retrieve campaign script content if script_id is provided
            let scriptContent = null;
            if (scriptId) {
                try {
                    const scriptResult = await query(`
                        SELECT content, variables, type
                        FROM scripts
                        WHERE id = $1 AND organization_id = $2 AND is_active = true
                    `, [scriptId, organizationId]);

                    if (scriptResult.rows.length > 0) {
                        scriptContent = scriptResult.rows[0].content;

                        // Replace script variables with contact data
                        scriptContent = scriptContent
                            .replace(/\{first_name\}/g, contact.first_name || 'there')
                            .replace(/\{name\}/g, contact.first_name || 'there')
                            .replace(/\{last_name\}/g, contact.last_name || '')
                            .replace(/\{company\}/g, contact.company || 'your company')
                            .replace(/\{title\}/g, contact.title || '');

                        logger.info(`✅ [AI-CONVERSATION] Campaign script loaded and personalized`);
                        logger.info(`   Script preview: "${scriptContent.substring(0, 100)}..."`);
                    } else {
                        logger.warn(`⚠️  [AI-CONVERSATION] Script ID ${scriptId} not found or inactive, using default greeting`);
                    }
                } catch (scriptErr) {
                    logger.error(`❌ [AI-CONVERSATION] Failed to load script:`, scriptErr);
                    // Continue with default greeting
                }
            } else {
                logger.info(`ℹ️  [AI-CONVERSATION] No script_id provided, using default greeting`);
            }

            // Update call status
            await query(`
                UPDATE calls
                SET status = 'in_progress', updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
            `, [callId]);

            logger.info(`✅ [AI-CONVERSATION] Call status updated to in_progress`);

            // Broadcast status update
            WebSocketBroadcaster.broadcastToOrganization(organizationId, {
                type: 'call_status_update',
                call_id: callId,
                status: 'in_progress',
                timestamp: new Date().toISOString()
            });

            // Get campaign voice_persona for TTS
           voicePersona = 'amy'; // Default voice
            try {
                const campaignResult = await query(`
                    SELECT voice_persona
                    FROM campaigns
                    WHERE id = $1
                `, [campaignId]);

                if (campaignResult.rows.length > 0 && campaignResult.rows[0].voice_persona) {
                    // Map voice_persona to Piper voice
                    const voiceMap = {
                        'professional': 'ryan',
                        'casual': 'amy',
                        'empathetic': 'kristin',
                        'enthusiastic': 'amy'
                    };
                    voicePersona = voiceMap[campaignResult.rows[0].voice_persona] || 'amy';
                    logger.info(`📢 [AI-CONVERSATION] Campaign voice_persona: ${campaignResult.rows[0].voice_persona} -> ${voicePersona}`);
                }
            } catch (voiceErr) {
                logger.warn(`⚠️  [AI-CONVERSATION] Failed to get campaign voice_persona, using default:`, voiceErr.message);
            }

            // Initialize conversation state with script content and voice
            this.conversationStates.set(callId, {
                callControlId,
                callId,
                campaignId,
                organizationId,
                contactId,
                scriptId: scriptId || null,
                scriptContent: scriptContent || null,
                voicePersona: voicePersona, // Store voice for subsequent TTS calls
                turnNumber: 0,
                conversationHistory: []
            });

            logger.info(`🤖 [AI-CONVERSATION] Conversation state initialized with script`);

            // Get initial greeting from conversation engine (pass script content)
            logger.info(`🤖 [AI-CONVERSATION] Getting initial greeting...`);
            const greeting = await this.getAIResponse(callId, 'initial_greeting', campaignId, 0, [], scriptContent);
            logger.info(`💬 [AI-CONVERSATION] Turn 0 (Greeting): "${greeting.answer}"`);


            // Store greeting turn
            await this.storeConversationTurn(callId, organizationId, null, greeting.answer, 1, {
                intent: greeting.intent,
                emotion: greeting.emotion,
                confidence: greeting.confidence
            });

            // Get voice_persona from conversation state
            const state = this.conversationStates.get(callId);
            const voicePersona = state?.voicePersona || 'amy';

            // Generate TTS audio with campaign voice
            logger.info(`🎤 [AI-CONVERSATION] Generating TTS for greeting...`);
            let audioUrl;
            try {
                audioUrl = await this.generateTTS(greeting.answer, voicePersona, callId);
                logger.info(`✅ [AI-CONVERSATION] TTS generated: ${audioUrl.substring(0, 50)}...`);
            } catch (ttsErr) {
                logger.error(`❌ [AI-CONVERSATION] TTS generation failed:`, ttsErr.message);
                // Fallback: Use Telnyx TTS (costs money but works)
                logger.warn(`⚠️  [AI-CONVERSATION] Falling back to Telnyx TTS...`);
                try {
                    await telnyxCallControl.speakText(callControlId, greeting.answer, voicePersona === 'ryan' ? 'male' : 'female');
                    logger.info(`✅ [AI-CONVERSATION] Fallback TTS (Telnyx) started`);
                    return; // Exit early - Telnyx TTS doesn't need playback command
                } catch (telnyxTtsErr) {
                    logger.error(`❌ [AI-CONVERSATION] Telnyx TTS fallback also failed:`, telnyxTtsErr.message);
                    throw ttsErr; // Re-throw original error
                }
            }

            // Play to customer
            logger.info(`🔊 [AI-CONVERSATION] Playing greeting to customer...`);
            try {
                await telnyxCallControl.playAudio(callControlId, audioUrl);
                logger.info(`✅ [AI-CONVERSATION] Greeting playback started`);
            } catch (playErr) {
                logger.error(`❌ [AI-CONVERSATION] Failed to play audio:`, playErr.message);
                // Try fallback Telnyx TTS
                logger.warn(`⚠️  [AI-CONVERSATION] Falling back to Telnyx TTS for playback...`);
                await telnyxCallControl.speakText(callControlId, greeting.answer, voicePersona === 'ryan' ? 'male' : 'female');
            }

        } catch (error) {
            logger.error(`❌ [AI-CONVERSATION] Error handling call answered for ${callId}:`, error);
            logger.error(`   Error details: ${error.message}`);
            // Try to hangup gracefully
            await telnyxCallControl.hangupCall(callControlId).catch(err => {
                logger.error('❌ [AI-CONVERSATION] Failed to hangup after error:', err);
            });
        }
    }

    /**
     * Handle playback ended - start recording customer
     */
    async handlePlaybackEnded(callControlId, metadata) {
        const { callId } = metadata;

        try {
            const state = this.conversationStates.get(callId);

            if (!state) {
                logger.warn(`No conversation state found for call ${callId}`);
                return;
            }

            // Check if we've reached max turns
            if (state.turnNumber >= this.maxTurns) {
                logger.info(`Max turns reached for call ${callId}, ending conversation`);
                await this.endConversation(callControlId, metadata, 'max_turns_reached');
                return;
            }

            // Start recording customer response
            await telnyxCallControl.startRecording(callControlId, 10); // 10 second max

            logger.info(`🎙️  Recording customer response for call ${callId}`);

        } catch (error) {
            logger.error(`❌ Error handling playback ended for ${callId}:`, error);
        }
    }

    /**
     * Handle recording saved - transcribe and respond
     */
    async handleRecordingSaved(callControlId, recordingUrl, metadata) {
        const { callId, campaignId, organizationId } = metadata;

        try {
            logger.info(`📼 [AI-CONVERSATION] Recording saved for call ${callId}`);
            logger.info(`   Processing customer response...`);

            const state = this.conversationStates.get(callId);

            if (!state) {
                logger.warn(`⚠️  [AI-CONVERSATION] No conversation state found for call ${callId}`);
                return;
            }

            // Download recording from Telnyx
            logger.info(`📥 [AI-CONVERSATION] Downloading recording from Telnyx...`);
            const audioData = await telnyxCallControl.downloadRecording(recordingUrl);
            logger.info(`✅ [AI-CONVERSATION] Recording downloaded (${audioData.length} bytes)`);

            // Save temporarily
            const tempPath = path.join('/tmp', `recording_${callId}_${Date.now()}.wav`);
            fs.writeFileSync(tempPath, audioData);
            logger.info(`💾 [AI-CONVERSATION] Saved to temp file: ${tempPath}`);

            // Transcribe with Vosk STT
            logger.info(`🎤 [AI-CONVERSATION] Transcribing audio...`);
            const transcript = await this.transcribeAudio(tempPath);

            // Cleanup temp file
            fs.unlinkSync(tempPath);
            logger.info(`🗑️  [AI-CONVERSATION] Temp file cleaned up`);

            if (!transcript || transcript.trim() === '') {
                logger.warn(`⚠️  [AI-CONVERSATION] No speech detected in recording`);

                // Ask customer to repeat
                const audioUrl = await this.generateTTS("I didn't catch that. Could you please repeat?");
                await telnyxCallControl.playAudio(callControlId, audioUrl);
                return;
            }

            logger.info(`💬 [AI-CONVERSATION] Turn ${state.turnNumber + 1} - Customer: "${transcript}"`);

            // Increment turn
            state.turnNumber++;

            // Process with AI conversation engine (pass script content from state)
            logger.info(`🤖 [AI-CONVERSATION] Processing AI response for turn ${state.turnNumber}...`);
            const aiResponse = await this.getAIResponse(
                callId,
                transcript,
                campaignId,
                state.turnNumber,
                state.conversationHistory,
                state.scriptContent // Pass script content to conversation engine
            );

            logger.info(`💬 [AI-CONVERSATION] Turn ${state.turnNumber} - AI: "${aiResponse.answer}"`);
            logger.info(`   Intent: ${aiResponse.intent}, Confidence: ${aiResponse.confidence}`);
            if (aiResponse.emotion) {
                logger.info(`   Emotion: ${aiResponse.emotion}`);
            }

            // Store conversation turn
            await this.storeConversationTurn(
                callId,
                organizationId,
                transcript,
                aiResponse.answer,
                state.turnNumber,
                {
                    intent: aiResponse.intent,
                    emotion: aiResponse.emotion,
                    confidence: aiResponse.confidence,
                    suggested_actions: aiResponse.suggested_actions
                }
            );

            // Add to history
            state.conversationHistory.push({
                user_input: transcript,
                ai_response: aiResponse.answer,
                turn: state.turnNumber
            });

            // Check if we should end conversation
            if (aiResponse.should_fallback ||
                aiResponse.suggested_actions?.includes('end_call') ||
                aiResponse.suggested_actions?.includes('schedule_meeting') ||
                aiResponse.suggested_actions?.includes('added_to_dnc')) {

                logger.info(`AI suggests ending call ${callId}`);

                // Play final response with voice from state
                const voicePersona = state.voicePersona || 'amy';
                let audioUrl;
                try {
                    audioUrl = await this.generateTTS(aiResponse.answer, voicePersona, callId);
                    await telnyxCallControl.playAudio(callControlId, audioUrl);
                } catch (ttsErr) {
                    logger.error(`❌ [AI-CONVERSATION] TTS failed for final response, using Telnyx fallback:`, ttsErr.message);
                    await telnyxCallControl.speakText(callControlId, aiResponse.answer, voicePersona === 'ryan' ? 'male' : 'female');
                }

                // Wait a bit then hangup
                setTimeout(() => {
                    this.endConversation(callControlId, metadata, 'ai_ended');
                }, 3000);

                return;
            }

            // Generate TTS for AI response with voice from state
            const voicePersona = state.voicePersona || 'amy';
            let audioUrl;
            try {
                audioUrl = await this.generateTTS(aiResponse.answer, voicePersona, callId);
                logger.info(`✅ [AI-CONVERSATION] TTS generated for turn ${state.turnNumber}`);
            } catch (ttsErr) {
                logger.error(`❌ [AI-CONVERSATION] TTS generation failed, using Telnyx fallback:`, ttsErr.message);
                // Fallback to Telnyx TTS
                try {
                    await telnyxCallControl.speakText(callControlId, aiResponse.answer, voicePersona === 'ryan' ? 'male' : 'female');
                    logger.info(`✅ [AI-CONVERSATION] Fallback TTS (Telnyx) started`);
                    return; // Exit early - Telnyx TTS doesn't need playback command
                } catch (telnyxTtsErr) {
                    logger.error(`❌ [AI-CONVERSATION] Telnyx TTS fallback also failed:`, telnyxTtsErr.message);
                    throw ttsErr; // Re-throw original error
                }
            }

            // Play to customer
            try {
                await telnyxCallControl.playAudio(callControlId, audioUrl);
                logger.info(`✅ [AI-CONVERSATION] AI response playback started`);
            } catch (playErr) {
                logger.error(`❌ [AI-CONVERSATION] Failed to play audio, using Telnyx TTS fallback:`, playErr.message);
                // Fallback to Telnyx TTS
                await telnyxCallControl.speakText(callControlId, aiResponse.answer, voicePersona === 'ryan' ? 'male' : 'female');
            }

        } catch (error) {
            logger.error(`❌ Error handling recording for ${callId}:`, error);

            // Try to end gracefully
            await this.endConversation(callControlId, metadata, 'error').catch(err => {
                logger.error('Failed to end conversation after error:', err);
            });
        }
    }

    /**
     * Handle call hangup - save transcript
     */
    async handleCallEnded(callControlId, metadata, duration) {
        const { callId, organizationId, contactId } = metadata;

        try {
            logger.info(`📴 Call ended: ${callId}, duration: ${duration}s`);

            // Remove from active states
            this.conversationStates.delete(callId);

            // Aggregate transcript from call_events
            logger.info(`📝 [CALL-END] Collecting conversation transcript for call ${callId}...`);
            const eventsResult = await query(`
                SELECT event_data, timestamp
                FROM call_events
                WHERE call_id = $1 AND event_type = 'ai_conversation'
                ORDER BY timestamp ASC
            `, [callId]);

            logger.info(`📝 [CALL-END] Found ${eventsResult.rows.length} conversation turns`);

            let transcript = '';
            let lastTurn = null;
            let turnCount = 0;

            eventsResult.rows.forEach((row, index) => {
                const data = row.event_data;
                const timestamp = row.timestamp ? new Date(row.timestamp).toLocaleTimeString('en-US', { hour12: false }) : '';

                // Format: Turn X [Timestamp]
                // Customer: [user_input]
                // AI: [ai_response]

                if (data.user_input && data.user_input !== 'initial_greeting') {
                    turnCount++;
                    transcript += `\n--- Turn ${turnCount} ${timestamp ? `[${timestamp}]` : ''} ---\n`;
                    transcript += `Customer: ${data.user_input}\n`;
                }

                if (data.ai_response) {
                    if (!data.user_input || data.user_input === 'initial_greeting') {
                        // Initial greeting - no turn number needed
                        transcript += `\n--- Opening ${timestamp ? `[${timestamp}]` : ''} ---\n`;
                    }
                    transcript += `AI: ${data.ai_response}\n`;
                }

                // Store last turn for outcome determination
                if (data.user_input && data.user_input !== 'initial_greeting') {
                    lastTurn = data;
                } else if (data.ai_response && !lastTurn) {
                    // If only AI response (greeting), use it for outcome if no other turns
                    lastTurn = data;
                }
            });

            // Trim and ensure transcript isn't empty
            transcript = transcript.trim();

            if (!transcript) {
                logger.warn(`⚠️  [CALL-END] No conversation transcript found for call ${callId}`);
                transcript = 'No conversation recorded.';
            } else {
                logger.info(`✅ [CALL-END] Built transcript with ${turnCount} turns (${transcript.length} chars)`);
            }

            // Determine outcome based on last turn
            let outcome = 'completed';
            if (lastTurn) {
                if (lastTurn.suggested_actions?.includes('schedule_meeting')) {
                    outcome = 'scheduled';
                } else if (lastTurn.emotion === 'interested') {
                    outcome = 'interested';
                } else if (lastTurn.suggested_actions?.includes('added_to_dnc')) {
                    outcome = 'dnc_request';
                } else if (lastTurn.emotion === 'frustrated' || lastTurn.intent === 'not_interested') {
                    outcome = 'not_interested';
                }
            }

            // Calculate cost
            const durationMinutes = duration / 60;
            const cost = durationMinutes * 0.011; // Telnyx rate

            // Extract emotion and intent from last turn
            const emotion = lastTurn?.emotion || 'neutral';
            const intentScore = lastTurn?.confidence ? parseFloat(lastTurn.confidence) : 0.5;

            // Update call record with transcript
            try {
                await query(`
                    UPDATE calls
                    SET
                        status = 'completed',
                        outcome = $1,
                        transcript = $2,
                        duration = $3,
                        cost = $4,
                        emotion = $5,
                        intent_score = $6,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = $7
                `, [outcome, transcript, duration, cost, emotion, intentScore, callId]);

                logger.info(`✅ [CALL-END] ${callId}: Call record updated with transcript`);
                logger.info(`   Outcome: ${outcome}`);
                logger.info(`   Emotion: ${emotion}`);
                logger.info(`   Duration: ${duration}s`);
                logger.info(`   Cost: $${cost.toFixed(4)}`);
                logger.info(`   Transcript length: ${transcript.length} chars`);
            } catch (dbErr) {
                logger.error(`❌ [CALL-END] Failed to update call record with transcript:`, dbErr);
                // Try without transcript
                try {
                    await query(`
                        UPDATE calls
                        SET status = 'completed', outcome = $1, duration = $2, cost = $3, updated_at = CURRENT_TIMESTAMP
                        WHERE id = $4
                    `, [outcome, duration, cost, callId]);
                    logger.warn(`⚠️  [CALL-END] Updated call record without transcript`);
                } catch (fallbackErr) {
                    logger.error(`❌ [CALL-END] Failed to update call record even without transcript:`, fallbackErr);
                }
            }

            // Update contact status
            await query(`
                UPDATE contacts
                SET
                    status = CASE
                        WHEN $1 = 'dnc_request' THEN 'dnc'
                        WHEN $1 IN ('scheduled', 'interested') THEN 'contacted'
                        ELSE 'contacted'
                    END,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $2
            `, [outcome, contactId]);

            // Broadcast call ended with transcript summary
            try {
                WebSocketBroadcaster.broadcastCallEnded(organizationId, callId, {
                    status: 'completed',
                    outcome,
                    duration,
                    cost,
                    totalTurns: turnCount,
                    emotion,
                    intentScore: intentScore,
                    hasTranscript: transcript && transcript !== 'No conversation recorded.'
                });
                logger.info(`📡 [CALL-END] Broadcasted call_ended event via WebSocket`);
            } catch (wsErr) {
                logger.error(`❌ [CALL-END] Failed to broadcast call_ended (non-blocking):`, wsErr.message);
            }

            logger.info(`✅ Call ${callId} saved with outcome: ${outcome}`);

        } catch (error) {
            logger.error(`❌ Error handling call ended for ${callId}:`, error);
        }
    }

    /**
     * End conversation gracefully
     */
    async endConversation(callControlId, metadata, reason) {
        logger.info(`Ending conversation for call ${metadata.callId}, reason: ${reason}`);

        try {
            // Hangup call
            await telnyxCallControl.hangupCall(callControlId);

            // Note: handleCallEnded will be called by the hangup webhook

        } catch (error) {
            logger.error(`Error ending conversation:`, error);
        }
    }

    /**
     * Get AI response from conversation engine
     */
    async getAIResponse(callId, userInput, campaignId, turnNumber, conversationHistory = [], scriptContent = null) {
        try {
            logger.info(`🤖 [AI-CONVERSATION] Calling conversation engine...`);
            logger.info(`   User Input: "${userInput}"`);
            logger.info(`   Turn Number: ${turnNumber}`);
            logger.info(`   Script Content: ${scriptContent ? 'Provided (' + scriptContent.length + ' chars)' : 'Not provided'}`);

            // Get conversation state to access script content if available
            const state = this.conversationStates.get(callId);
            const scriptToUse = scriptContent || state?.scriptContent || null;

            const response = await axios.post(
                `${this.apiBaseUrl}/api/v1/conversation/process`,
                {
                    call_id: callId,
                    user_input: userInput,
                    context: {
                        campaign_id: campaignId,
                        turn: turnNumber,
                        conversation_history: conversationHistory,
                        script_content: scriptToUse // Pass script content to conversation engine
                    }
                },
                { timeout: 15000 }
            );

            logger.info(`✅ [AI-CONVERSATION] Conversation engine responded`);
            logger.info(`   Response: "${response.data.answer?.substring(0, 100)}..."`);

            return response.data;

        } catch (error) {
            logger.error(`❌ [AI-CONVERSATION] Error getting AI response:`, error.message);
            if (error.response) {
                logger.error(`   API Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
            }

            // Fallback response based on context
            let fallbackAnswer = "I'm sorry, could you repeat that?";

            if (turnNumber === 0 || userInput === 'initial_greeting') {
                fallbackAnswer = "Hello! Thank you for answering. I'm calling to share some information that might interest you. How are you doing today?";
            } else if (userInput.toLowerCase().includes('yes') || userInput.toLowerCase().includes('interested')) {
                fallbackAnswer = "That's great to hear! Let me share more details with you.";
            } else if (userInput.toLowerCase().includes('no') || userInput.toLowerCase().includes('not interested')) {
                fallbackAnswer = "I understand. Thank you for your time. Have a great day!";
            }

            logger.info(`🔄 [AI-CONVERSATION] Using fallback response: "${fallbackAnswer}"`);

            return {
                answer: fallbackAnswer,
                confidence: 0.5,
                emotion: 'neutral',
                intent: userInput === 'initial_greeting' ? 'greeting' : 'clarification',
                should_fallback: false
            };
        }
    }

    /**
     * Generate TTS audio using Piper
     * @param {string} text - Text to convert to speech
     * @param {string} voice - Voice to use (amy, ryan, etc.) - can be from campaign voice_persona
     * @param {string} callId - Optional call ID for logging
     */
    async generateTTS(text, voice = 'amy', callId = null) {
        try {
            logger.info(`🎤 [TTS] Generating TTS for text: "${text.substring(0, 50)}..."`);
            logger.info(`   Voice: ${voice}`);
            logger.info(`   Call ID: ${callId || 'N/A'}`);

            // Use public API URL for audio serving (Telnyx needs public URL)
            // API_URL is the public URL, API_INTERNAL_URL is for internal calls
            const publicApiUrl = process.env.API_URL || 'https://atsservice.site';

            if (!publicApiUrl || publicApiUrl.includes('localhost') || publicApiUrl.includes('127.0.0.1')) {
                logger.error(`❌ [TTS] API_URL must be publicly accessible. Current: ${publicApiUrl}`);
                logger.error(`   Telnyx cannot fetch audio files from localhost. Set API_URL to your public domain.`);
                throw new Error('API_URL must be publicly accessible for Telnyx to fetch audio files');
            }

            logger.info(`🎤 [TTS] Using public API URL for audio serving: ${publicApiUrl}`);

            // Call internal TTS endpoint (can use internal URL)
            const response = await axios.post(
                `${this.apiBaseUrl}/api/v1/asterisk/tts/generate`,
                {
                    text,
                    voice: voice || 'amy',
                    speed: 1.0
                },
                { timeout: 15000 }
            );

            if (!response.data || !response.data.audio_url) {
                throw new Error('TTS did not return audio URL');
            }

            // Convert relative URL to absolute PUBLIC URL (Telnyx needs public URL)
            let audioUrl = response.data.audio_url;
            if (!audioUrl.startsWith('http')) {
                // Use public API URL, not internal URL
                audioUrl = `${publicApiUrl}${audioUrl}`;
                logger.info(`✅ [TTS] Converted relative URL to public URL: ${audioUrl.substring(0, 80)}...`);
            }

            // Verify URL is publicly accessible (not localhost)
            if (audioUrl.includes('localhost') || audioUrl.includes('127.0.0.1')) {
                logger.error(`❌ [TTS] Audio URL is not publicly accessible: ${audioUrl}`);
                throw new Error(`Audio URL must be publicly accessible. Current: ${audioUrl}`);
            }

            logger.info(`✅ [TTS] TTS generated successfully`);
            logger.info(`   Audio URL: ${audioUrl.substring(0, 80)}...`);

            return audioUrl;

        } catch (error) {
            logger.error(`❌ [TTS] Error generating TTS:`, error.message);
            if (error.response) {
                logger.error(`   TTS API Error: ${JSON.stringify(error.response.data)}`);
            }

            // Fallback: Use Telnyx TTS if Piper fails (costs money but works)
            logger.warn(`⚠️  [TTS] Piper TTS failed, this is a fallback scenario`);
            throw error; // Re-throw so caller can handle
        }
    }

    /**
     * Transcribe audio using Vosk STT
     */
    async transcribeAudio(audioFilePath) {
        try {
            const form = new FormData();
            form.append('audio', fs.createReadStream(audioFilePath));

            const response = await axios.post(
                `${this.apiBaseUrl}/api/v1/asterisk/speech/transcribe`,
                form,
                {
                    headers: form.getHeaders(),
                    timeout: 20000
                }
            );

            if (response.data.success && response.data.text) {
                return response.data.text.trim();
            }

            return '';

        } catch (error) {
            logger.error('Error transcribing audio:', error.message);
            return '';
        }
    }

    /**
     * Store conversation turn in database and broadcast
     */
    async storeConversationTurn(callId, organizationId, userInput, aiResponse, turnNumber, metadata = {}) {
        try {
            const eventData = {
                user_input: userInput,
                ai_response: aiResponse,
                turn: turnNumber,
                timestamp: new Date().toISOString(),
                ...metadata
            };

            // Store in database
            await query(`
                INSERT INTO call_events (call_id, event_type, event_data, timestamp)
                VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
            `, [callId, 'ai_conversation', JSON.stringify(eventData)]);

            // Broadcast via WebSocket for live monitoring using proper method
            try {
                WebSocketBroadcaster.broadcastConversationTurn(organizationId, callId, {
                    user_input: userInput,
                    ai_response: aiResponse,
                    turn: turnNumber,
                    emotion: metadata.emotion,
                    intent: metadata.intent,
                    confidence: metadata.confidence,
                    suggested_actions: metadata.suggested_actions,
                    timestamp: new Date().toISOString()
                });
                logger.info(`📡 [WEBSOCKET] Broadcasted conversation turn ${turnNumber} for call ${callId}`);
            } catch (wsErr) {
                logger.error(`❌ [WEBSOCKET] Failed to broadcast conversation turn (non-blocking):`, wsErr.message);
                // Don't throw - conversation turn should still be stored
            }

            logger.info(`📝 Stored conversation turn ${turnNumber} for call ${callId}`);

        } catch (error) {
            logger.error('Error storing conversation turn:', error);
        }
    }

    /**
     * Get active conversation count
     */
    getActiveConversationCount() {
        return this.conversationStates.size;
    }

    /**
     * Get conversation state
     */
    getConversationState(callId) {
        return this.conversationStates.get(callId);
    }
}

module.exports = new TelnyxAIConversation();
