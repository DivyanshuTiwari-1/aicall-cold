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
        this.apiBaseUrl = process.env.API_INTERNAL_URL || process.env.API_URL || 'http://localhost:3000';
        this.conversationStates = new Map(); // callId -> state
        this.maxTurns = 20;
    }

    /**
     * Handle call answered - start AI conversation
     */
    async handleCallAnswered(callControlId, metadata) {
        const { callId, campaignId, organizationId, contactId } = metadata;

        try {
            logger.info(`📞 Call answered: ${callId}, starting AI conversation`);

            // Update call status
            await query(`
                UPDATE calls
                SET status = 'in_progress', updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
            `, [callId]);

            // Broadcast status update
            WebSocketBroadcaster.broadcastToOrganization(organizationId, {
                type: 'call_status_update',
                call_id: callId,
                status: 'in_progress',
                timestamp: new Date().toISOString()
            });

            // Initialize conversation state
            this.conversationStates.set(callId, {
                callControlId,
                callId,
                campaignId,
                organizationId,
                contactId,
                turnNumber: 0,
                conversationHistory: []
            });

            // Get initial greeting from conversation engine
            const greeting = await this.getAIResponse(callId, 'initial_greeting', campaignId, 0);

            // Store greeting turn
            await this.storeConversationTurn(callId, organizationId, null, greeting.answer, 1, {
                intent: greeting.intent,
                emotion: greeting.emotion,
                confidence: greeting.confidence
            });

            // Generate TTS audio
            const audioUrl = await this.generateTTS(greeting.answer);

            // Play to customer
            await telnyxCallControl.playAudio(callControlId, audioUrl);

            logger.info(`🎤 AI greeting played to customer`);

        } catch (error) {
            logger.error(`❌ Error handling call answered for ${callId}:`, error);
            // Try to hangup gracefully
            await telnyxCallControl.hangupCall(callControlId).catch(err => {
                logger.error('Failed to hangup after error:', err);
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
            logger.info(`📼 Recording saved for call ${callId}, processing...`);

            const state = this.conversationStates.get(callId);

            if (!state) {
                logger.warn(`No conversation state found for call ${callId}`);
                return;
            }

            // Download recording from Telnyx
            const audioData = await telnyxCallControl.downloadRecording(recordingUrl);

            // Save temporarily
            const tempPath = path.join('/tmp', `recording_${callId}_${Date.now()}.wav`);
            fs.writeFileSync(tempPath, audioData);

            // Transcribe with Vosk STT
            const transcript = await this.transcribeAudio(tempPath);

            // Cleanup temp file
            fs.unlinkSync(tempPath);

            if (!transcript || transcript.trim() === '') {
                logger.info('No speech detected, asking customer to repeat');

                // Ask customer to repeat
                const audioUrl = await this.generateTTS("I didn't catch that. Could you please repeat?");
                await telnyxCallControl.playAudio(callControlId, audioUrl);
                return;
            }

            logger.info(`🗣️  Customer said: ${transcript.substring(0, 100)}...`);

            // Increment turn
            state.turnNumber++;

            // Process with AI conversation engine
            const aiResponse = await this.getAIResponse(
                callId,
                transcript,
                campaignId,
                state.turnNumber,
                state.conversationHistory
            );

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

                // Play final response
                const audioUrl = await this.generateTTS(aiResponse.answer);
                await telnyxCallControl.playAudio(callControlId, audioUrl);

                // Wait a bit then hangup
                setTimeout(() => {
                    this.endConversation(callControlId, metadata, 'ai_ended');
                }, 3000);

                return;
            }

            // Generate TTS for AI response
            const audioUrl = await this.generateTTS(aiResponse.answer);

            // Play to customer
            await telnyxCallControl.playAudio(callControlId, audioUrl);

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
            const eventsResult = await query(`
                SELECT event_data
                FROM call_events
                WHERE call_id = $1 AND event_type = 'ai_conversation'
                ORDER BY timestamp ASC
            `, [callId]);

            let transcript = '';
            let lastTurn = null;

            eventsResult.rows.forEach(row => {
                const data = row.event_data;
                if (data.user_input) {
                    transcript += `Customer: ${data.user_input}\n`;
                }
                if (data.ai_response) {
                    transcript += `AI: ${data.ai_response}\n\n`;
                }
                lastTurn = data;
            });

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

            // Update call record
            await query(`
                UPDATE calls
                SET
                    status = 'completed',
                    outcome = $1,
                    transcript = $2,
                    duration = $3,
                    cost = $4,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $5
            `, [outcome, transcript, duration, cost, callId]);

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

            // Broadcast call ended
            WebSocketBroadcaster.broadcastToOrganization(organizationId, {
                type: 'call_ended',
                call_id: callId,
                outcome,
                duration,
                cost,
                timestamp: new Date().toISOString()
            });

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
    async getAIResponse(callId, userInput, campaignId, turnNumber, conversationHistory = []) {
        try {
            const response = await axios.post(
                `${this.apiBaseUrl}/api/v1/conversation/process`,
                {
                    call_id: callId,
                    user_input: userInput,
                    context: {
                        campaign_id: campaignId,
                        turn: turnNumber,
                        conversation_history: conversationHistory
                    }
                },
                { timeout: 15000 }
            );

            return response.data;

        } catch (error) {
            logger.error('Error getting AI response:', error.message);

            // Fallback response
            return {
                answer: "I'm sorry, could you repeat that?",
                confidence: 0.3,
                emotion: 'confused',
                intent: 'clarification'
            };
        }
    }

    /**
     * Generate TTS audio using Piper
     */
    async generateTTS(text) {
        try {
            const response = await axios.post(
                `${this.apiBaseUrl}/api/v1/asterisk/tts/generate`,
                {
                    text,
                    voice: 'amy',
                    speed: 1.0
                },
                { timeout: 15000 }
            );

            if (!response.data.audio_url) {
                throw new Error('TTS did not return audio URL');
            }

            // Convert relative URL to absolute if needed
            let audioUrl = response.data.audio_url;
            if (!audioUrl.startsWith('http')) {
                audioUrl = `${this.apiBaseUrl}${audioUrl}`;
            }

            return audioUrl;

        } catch (error) {
            logger.error('Error generating TTS:', error.message);
            throw error;
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

            // Broadcast via WebSocket for live monitoring
            WebSocketBroadcaster.broadcastToOrganization(organizationId, {
                type: 'conversation_turn',
                call_id: callId,
                user_input: userInput,
                ai_response: aiResponse,
                turn: turnNumber,
                emotion: metadata.emotion,
                intent: metadata.intent,
                confidence: metadata.confidence,
                timestamp: new Date().toISOString()
            });

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
