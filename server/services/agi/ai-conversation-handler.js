const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const { query } = require('../../config/database');
const logger = require('../../utils/logger');

/**
 * AI Conversation Handler for Automated Calls
 * Manages the complete conversation flow between AI and customer
 */

class AiConversationHandler {
    constructor(agiContext, callParams) {
        this.agi = agiContext;
        this.callId = callParams.callId;
        this.phoneNumber = callParams.phoneNumber;
        this.campaignId = callParams.campaignId;
        this.conversationTurns = [];
        this.maxTurns = 20;
        this.recordingTimeout = 10000;
        // Use Docker service name in production, localhost for development
        this.apiBaseUrl = process.env.API_INTERNAL_URL || process.env.API_URL || 'http://localhost:3000';
    }

    /**
     * Main conversation handler
     */
    async handleConversation() {
        try {
            logger.info(`🤖 Starting AI conversation for call ${this.callId}`);

            // Answer the call
            await this.sendCommand('ANSWER');
            await this.sleep(500);

            // Update call status to in_progress
            await this.updateCallStatus('in_progress');

            // Broadcast call started event
            await this.broadcastCallStarted();

            // Get initial greeting from conversation engine
            const greeting = await this.getInitialGreeting();

            // Play greeting to customer
            await this.speakText(greeting.answer || greeting.ai_response || 'Hello, thank you for answering.');

            // Log initial turn
            await this.logConversationTurn(null, greeting.answer, 1, {
                intent: greeting.intent,
                emotion: greeting.emotion,
                confidence: greeting.confidence
            });

            // Main conversation loop
            let turnNumber = 1;
            let shouldContinue = true;

            while (shouldContinue && turnNumber < this.maxTurns) {
                turnNumber++;

                // Wait for customer response
                const customerSpeech = await this.recordAndTranscribe();

                if (!customerSpeech || customerSpeech.trim() === '') {
                    logger.info('No customer response detected');

                    // Ask if they're still there
                    if (turnNumber < 3) {
                        await this.speakText('Are you still there? I didn\'t catch that.');
                        continue;
                    } else {
                        // End call after multiple no-responses
                        await this.speakText('I\'ll let you go now. Have a great day!');
                        break;
                    }
                }

                logger.info(`Customer said: ${customerSpeech.substring(0, 100)}...`);

                // Process with AI conversation engine
                const aiResponse = await this.processConversation(customerSpeech, turnNumber);

                // Check if AI suggests ending call
                if (aiResponse.should_fallback || aiResponse.suggested_actions?.includes('end_call')) {
                    logger.info('AI suggests ending call');
                    shouldContinue = false;
                }

                // Check for low confidence
                if (aiResponse.confidence < 0.3) {
                    logger.warn('Low AI confidence, considering handover');
                    shouldContinue = false;
                }

                // Play AI response to customer
                await this.speakText(aiResponse.answer);

                // Log conversation turn with full metadata
                await this.logConversationTurn(
                    customerSpeech,
                    aiResponse.answer,
                    turnNumber,
                    {
                        intent: aiResponse.intent,
                        emotion: aiResponse.emotion,
                        confidence: aiResponse.confidence,
                        suggested_actions: aiResponse.suggested_actions,
                        should_fallback: aiResponse.should_fallback
                    }
                );

                // Check for end-call indicators
                if (aiResponse.suggested_actions?.includes('schedule_meeting') ||
                    aiResponse.suggested_actions?.includes('added_to_dnc')) {
                    shouldContinue = false;
                }

                // Small delay between turns
                await this.sleep(500);
            }

            // End conversation gracefully
            if (turnNumber >= this.maxTurns) {
                logger.info('Maximum conversation turns reached');
                await this.speakText('Thank you for your time. Have a great day!');
            }

            // Update call as completed
            await this.completeCall(turnNumber);

            // Hangup
            await this.sendCommand('HANGUP');

            logger.info(`✅ AI conversation completed for call ${this.callId}`);

        } catch (error) {
            logger.error(`❌ Error in AI conversation for call ${this.callId}:`, error);

            // Try to end gracefully
            try {
                await this.speakText('I apologize, but I\'m experiencing technical difficulties. Goodbye.');
                await this.updateCallStatus('failed');
                await this.sendCommand('HANGUP');
            } catch (hangupError) {
                logger.error('Error during error cleanup:', hangupError);
            }
        }
    }

    /**
     * Get initial greeting from conversation engine
     */
    async getInitialGreeting() {
        try {
            const response = await axios.post(`${this.apiBaseUrl}/api/v1/conversation/process`, {
                call_id: this.callId,
                user_input: 'initial_greeting',
                context: {
                    campaign_id: this.campaignId,
                    contact_phone: this.phoneNumber,
                    turn: 0
                }
            }, {
                timeout: 10000
            });

            return response.data;
        } catch (error) {
            logger.error('Error getting initial greeting:', error);
            return {
                answer: 'Hello, thank you for answering. How are you today?',
                confidence: 0.5,
                emotion: 'neutral',
                intent: 'greeting'
            };
        }
    }

    /**
     * Process customer input with AI conversation engine
     */
    async processConversation(userInput, turnNumber) {
        try {
            const response = await axios.post(`${this.apiBaseUrl}/api/v1/conversation/process`, {
                call_id: this.callId,
                user_input: userInput,
                context: {
                    turn: turnNumber,
                    campaign_id: this.campaignId,
                    contact_phone: this.phoneNumber,
                    conversation_history: this.conversationTurns
                }
            }, {
                timeout: 15000
            });

            return response.data;
        } catch (error) {
            logger.error('Error processing conversation:', error);
            return {
                answer: 'I\'m sorry, could you repeat that?',
                confidence: 0.3,
                emotion: 'confused',
                intent: 'clarification',
                success: false
            };
        }
    }

    /**
     * Record customer speech and transcribe
     */
    async recordAndTranscribe() {
        try {
            // Generate unique filename (without extension - Asterisk adds it)
            const recordingBase = path.join('/tmp', `recording_${this.callId}_${Date.now()}`);
            const recordingFile = recordingBase + '.wav';

            // Record audio (10 seconds max, stop on silence)
            // Note: RECORD FILE expects path WITHOUT extension
            await this.sendCommand(`RECORD FILE ${recordingBase} wav # ${this.recordingTimeout/1000} s 3`);

            // Check if file exists and has content
            if (!fs.existsSync(recordingFile)) {
                logger.warn('Recording file does not exist');
                return '';
            }

            const stats = fs.statSync(recordingFile);
            if (stats.size < 1000) {
                logger.warn('Recording file too small, likely silence');
                try {
                    fs.unlinkSync(recordingFile);
                } catch (e) {
                    // Ignore cleanup errors
                }
                return '';
            }

            // Transcribe with STT service
            const transcript = await this.transcribeAudio(recordingFile);

            // Cleanup recording file
            try {
                fs.unlinkSync(recordingFile);
            } catch (cleanupError) {
                logger.warn('Error cleaning up recording file:', cleanupError);
            }

            return transcript;

        } catch (error) {
            logger.error('Error in record and transcribe:', error);
            return '';
        }
    }

    /**
     * Transcribe audio file using STT service
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
            logger.error('Error transcribing audio:', error);
            return '';
        }
    }

    /**
     * Convert text to speech and play to customer
     */
    async speakText(text) {
        try {
            logger.info(`AI speaking: ${text.substring(0, 100)}...`);

            // Get TTS audio
            const response = await axios.post(
                `${this.apiBaseUrl}/api/v1/asterisk/tts/generate`,
                {
                    text: text,
                    voice: 'amy',
                    speed: 1.0
                },
                {
                    timeout: 15000
                }
            );

            if (!response.data.audio_url) {
                throw new Error('TTS did not return audio URL');
            }

            // Extract audio filename from URL
            const audioUrl = response.data.audio_url;
            const audioFilename = audioUrl.split('/').pop();
            const tempAudioPath = path.join('/tmp', audioFilename);

            // If it's a full URL, download it
            if (audioUrl.startsWith('http')) {
                const audioData = await axios.get(audioUrl, { responseType: 'arraybuffer', timeout: 10000 });
                fs.writeFileSync(tempAudioPath, audioData.data);
            } else {
                // Local file path - resolve from root audio directory
                // In Docker, audio files are mounted at /app/audio
                const localFilename = audioUrl.split('/').pop();
                const possiblePaths = [
                    path.join('/app/audio/piper', localFilename),
                    path.join(__dirname, '../../audio/piper', localFilename),
                    path.join('/tmp', localFilename)
                ];

                let found = false;
                for (const sourcePath of possiblePaths) {
                    if (fs.existsSync(sourcePath)) {
                        fs.copyFileSync(sourcePath, tempAudioPath);
                        found = true;
                        break;
                    }
                }

                if (!found) {
                    throw new Error(`Audio file not found: ${localFilename}`);
                }
            }

            // Play audio file (Asterisk expects path without extension)
            const playPath = tempAudioPath.replace('.wav', '');
            await this.sendCommand(`STREAM FILE ${playPath} ""`);

            // Cleanup temp file
            try {
                if (fs.existsSync(tempAudioPath)) {
                    fs.unlinkSync(tempAudioPath);
                }
            } catch (cleanupError) {
                logger.warn('Could not cleanup temp audio file:', cleanupError.message);
            }

        } catch (error) {
            logger.error('Error in text-to-speech:', error);
            // Fallback to basic playback
            await this.sendCommand(`VERBOSE "${text}" 1`);
        }
    }

    /**
     * Log conversation turn to database and broadcast
     */
    async logConversationTurn(userInput, aiResponse, turnNumber, metadata = {}) {
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
                INSERT INTO call_events (call_id, event_type, event_data)
                VALUES ($1, $2, $3)
            `, [this.callId, 'ai_conversation', JSON.stringify(eventData)]);

            // Add to local history
            this.conversationTurns.push(eventData);

            // Broadcast via WebSocket
            await this.broadcastConversationTurn(eventData);

            logger.info(`📝 Logged conversation turn ${turnNumber} for call ${this.callId}`);

        } catch (error) {
            logger.error('Error logging conversation turn:', error);
        }
    }

    /**
     * Update call status in database
     */
    async updateCallStatus(status, additionalData = {}) {
        try {
            const updateFields = ['status = $1', 'updated_at = CURRENT_TIMESTAMP'];
            const params = [status];
            let paramCount = 1;

            if (additionalData.duration !== undefined) {
                paramCount++;
                updateFields.push(`duration = $${paramCount}`);
                params.push(additionalData.duration);
            }

            if (additionalData.outcome) {
                paramCount++;
                updateFields.push(`outcome = $${paramCount}`);
                params.push(additionalData.outcome);
            }

            params.push(this.callId);

            await query(`
                UPDATE calls
                SET ${updateFields.join(', ')}
                WHERE id = $${paramCount + 1}
            `, params);

            // Broadcast status update
            if (global.broadcastToOrganization) {
                const callData = await this.getCallData();
                if (callData?.organization_id) {
                    global.broadcastToOrganization(callData.organization_id, {
                        type: 'call_status_update',
                        call_id: this.callId,
                        status: status,
                        ...additionalData,
                        timestamp: new Date().toISOString()
                    });
                }
            }

        } catch (error) {
            logger.error('Error updating call status:', error);
        }
    }

    /**
     * Complete call with final data
     */
    async completeCall(totalTurns) {
        try {
            // Aggregate transcript from conversation turns
            const transcript = this.conversationTurns.map(turn => {
                let text = '';
                if (turn.user_input) {
                    text += `Customer: ${turn.user_input}\n`;
                }
                if (turn.ai_response) {
                    text += `AI: ${turn.ai_response}\n`;
                }
                return text;
            }).join('\n');

            // Determine outcome based on conversation
            let outcome = 'completed';
            const lastTurn = this.conversationTurns[this.conversationTurns.length - 1];

            if (lastTurn) {
                if (lastTurn.suggested_actions?.includes('schedule_meeting')) {
                    outcome = 'scheduled';
                } else if (lastTurn.emotion === 'interested') {
                    outcome = 'interested';
                } else if (lastTurn.suggested_actions?.includes('added_to_dnc')) {
                    outcome = 'dnc_request';
                } else if (lastTurn.emotion === 'frustrated') {
                    outcome = 'not_interested';
                }
            }

            await query(`
                UPDATE calls
                SET
                    status = 'completed',
                    outcome = $1,
                    transcript = $2,
                    duration = EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - created_at))::INTEGER,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $3
            `, [outcome, transcript, this.callId]);

            // Broadcast call ended
            const callData = await this.getCallData();
            if (callData?.organization_id && global.broadcastToOrganization) {
                global.broadcastToOrganization(callData.organization_id, {
                    type: 'call_ended',
                    call_id: this.callId,
                    outcome: outcome,
                    total_turns: totalTurns,
                    timestamp: new Date().toISOString()
                });
            }

            logger.info(`✅ Call ${this.callId} completed with outcome: ${outcome}`);

        } catch (error) {
            logger.error('Error completing call:', error);
        }
    }

    /**
     * Broadcast call started event
     */
    async broadcastCallStarted() {
        try {
            const callData = await this.getCallData();
            if (callData?.organization_id && global.broadcastToOrganization) {
                global.broadcastToOrganization(callData.organization_id, {
                    type: 'call_started',
                    call_id: this.callId,
                    phone_number: this.phoneNumber,
                    campaign_id: this.campaignId,
                    timestamp: new Date().toISOString()
                });
            }
        } catch (error) {
            logger.error('Error broadcasting call started:', error);
        }
    }

    /**
     * Broadcast conversation turn
     */
    async broadcastConversationTurn(eventData) {
        try {
            const callData = await this.getCallData();
            if (callData?.organization_id && global.broadcastToOrganization) {
                global.broadcastToOrganization(callData.organization_id, {
                    type: 'conversation_turn',
                    call_id: this.callId,
                    ...eventData,
                    timestamp: new Date().toISOString()
                });
            }
        } catch (error) {
            logger.error('Error broadcasting conversation turn:', error);
        }
    }

    /**
     * Get call data from database
     */
    async getCallData() {
        try {
            const result = await query(`
                SELECT * FROM calls WHERE id = $1
            `, [this.callId]);

            return result.rows[0];
        } catch (error) {
            logger.error('Error getting call data:', error);
            return null;
        }
    }

    /**
     * Send AGI command
     */
    async sendCommand(command) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                resolve('200 result=0'); // Default response on timeout
            }, 3000);

            this.agi.socket.write(command + '\n', (error) => {
                if (error) {
                    clearTimeout(timeout);
                    reject(error);
                } else {
                    // Wait for response
                    setTimeout(() => {
                        clearTimeout(timeout);
                        resolve(this.agi.lastResponse || '200 result=0');
                    }, 100);
                }
            });
        });
    }

    /**
     * Sleep utility
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = AiConversationHandler;
