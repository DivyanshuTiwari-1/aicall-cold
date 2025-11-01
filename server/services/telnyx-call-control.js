const telnyx = require('telnyx')(process.env.TELNYX_API_KEY);
const axios = require('axios');
const logger = require('../utils/logger');

/**
 * Telnyx Call Control Service
 * Handles direct call control via Telnyx API (no Asterisk needed for automated calls)
 */

class TelnyxCallControl {
    constructor() {
        this.apiKey = process.env.TELNYX_API_KEY;
        this.connectionId = process.env.TELNYX_CONNECTION_ID;
        this.phoneNumber = process.env.TELNYX_PHONE_NUMBER;
        this.webhookUrl = `${process.env.API_URL}/api/v1/webhooks/telnyx`;

        if (!this.apiKey || !this.connectionId) {
            logger.warn('⚠️  Telnyx Call Control not configured. Set TELNYX_API_KEY and TELNYX_CONNECTION_ID');
        }
    }

    /**
     * Validate Telnyx configuration and provide actionable errors
     */
    validateConfig() {
        const errors = [];
        const warnings = [];

        // API Key validation
        if (!this.apiKey) {
            errors.push('Missing TELNYX_API_KEY. Get your API key from https://portal.telnyx.com/#/app/api-keys');
        } else {
            // Telnyx API keys typically start with KEY and are 40+ chars
            const apiKeyPattern = /^KEY[A-Z0-9]{32,}$/i;
            if (!apiKeyPattern.test(this.apiKey)) {
                errors.push(`TELNYX_API_KEY format invalid. Expected format: KEY followed by 32+ alphanumeric characters (total 35+ chars). Current key length: ${this.apiKey.length}. Get a valid key from https://portal.telnyx.com/#/app/api-keys`);
            }
        }

        // Connection ID validation
        if (!this.connectionId) {
            errors.push('Missing TELNYX_CONNECTION_ID. Get your Connection ID from https://portal.telnyx.com/#/app/call-control/applications');
        } else {
            // Connection IDs are typically numeric strings
            if (!/^\d+$/.test(this.connectionId)) {
                warnings.push(`TELNYX_CONNECTION_ID format may be invalid. Expected numeric string.`);
            }
        }

        // Phone Number validation
        if (!this.phoneNumber) {
            warnings.push('TELNYX_PHONE_NUMBER not set. Using default from connection if available.');
        }

        // Webhook URL validation
        if (!process.env.API_URL) {
            errors.push('Missing API_URL environment variable. This must be your public server URL (e.g., https://yourdomain.com)');
        } else {
            const apiUrl = process.env.API_URL.toLowerCase();
            // Check for localhost patterns
            if (/localhost|127\.0\.0\.1|0\.0\.0\.0|::1|192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\./.test(apiUrl)) {
                errors.push(`API_URL is set to a local/private address (${process.env.API_URL}). Telnyx webhooks require a publicly accessible URL. Use your production domain (e.g., https://yourdomain.com) or a tunneling service like ngrok for testing.`);
            } else if (!apiUrl.startsWith('http://') && !apiUrl.startsWith('https://')) {
                errors.push(`API_URL must start with http:// or https://. Current value: ${process.env.API_URL}`);
            } else if (!apiUrl.startsWith('https://')) {
                warnings.push(`API_URL uses http:// instead of https://. Telnyx may require HTTPS for webhooks.`);
            }
        }

        // Log warnings (non-blocking)
        if (warnings.length > 0) {
            warnings.forEach(warning => logger.warn(`⚠️  [TELNYX-CONFIG] ${warning}`));
        }

        // Throw errors (blocking)
        if (errors.length > 0) {
            const message = `Telnyx configuration invalid: ${errors.join('; ')}`;
            logger.error(`❌ [TELNYX-CONFIG] ${message}`);
            const error = new Error(message);
            error.code = 'TELNYX_CONFIG_INVALID';
            error.details = errors;
            throw error;
        }

        logger.info(`✅ [TELNYX-CONFIG] Configuration validated successfully`);
        logger.info(`   API Key: ${this.apiKey ? this.apiKey.substring(0, 10) + '...' : 'NOT SET'}`);
        logger.info(`   Connection ID: ${this.connectionId || 'NOT SET'}`);
        logger.info(`   Phone Number: ${this.phoneNumber || 'NOT SET'}`);
        logger.info(`   Webhook URL: ${this.webhookUrl}`);
    }

    /**
     * Initiate automated AI call via Telnyx
     */
    async makeAICall({ callId, contact, campaignId, fromNumber, scriptId }) {
        try {
            // Validate configuration and provide helpful diagnostics early
            this.validateConfig();

            // Prepare metadata to send with call
            const metadata = {
                callId,
                contactId: contact.id,
                campaignId,
                organizationId: contact.organization_id,
                contactName: `${contact.first_name} ${contact.last_name}`,
                automated: true,
                scriptId: scriptId || null // Pass script_id through to webhooks
            };

            // Encode metadata as base64 for client_state
            const clientState = Buffer.from(JSON.stringify(metadata)).toString('base64');

            logger.info(`📞 [TELNYX] ============================================`);
            logger.info(`📞 [TELNYX] INITIATING AI AUTOMATED CALL`);
            logger.info(`📞 [TELNYX] ============================================`);
            logger.info(`📞 [TELNYX] Call ID (DB): ${callId}`);
            logger.info(`📞 [TELNYX] To: ${contact.phone}`);
            logger.info(`📞 [TELNYX] From: ${fromNumber || this.phoneNumber}`);
            logger.info(`📞 [TELNYX] Contact: ${contact.first_name} ${contact.last_name}`);
            logger.info(`📞 [TELNYX] Campaign: ${campaignId}`);
            logger.info(`📞 [TELNYX] Connection ID: ${this.connectionId}`);
            logger.info(`📞 [TELNYX] --------------------------------------------`);
            logger.info(`📞 [TELNYX] Creating call via Telnyx Call Control API...`);

            // Create call via Telnyx Call Control API using axios
            const response = await axios.post('https://api.telnyx.com/v2/calls', {
                connection_id: this.connectionId,
                to: contact.phone,
                from: fromNumber || this.phoneNumber,
                webhook_url: this.webhookUrl,
                webhook_url_method: 'POST',
                client_state: clientState,
                timeout_secs: 30,
                // Enable answering machine detection to avoid calling voicemail
                answering_machine_detection: 'detect',
                answering_machine_detection_config: {
                    after_greeting_silence_millis: 1000,
                    between_words_silence_millis: 1000,
                    greeting_duration_millis: 5000,
                    initial_silence_millis: 4000,
                    maximum_number_of_words: 5,
                    maximum_word_length_millis: 5000,
                    silence_threshold: 256,
                    total_analysis_time_millis: 5000
                }
            }, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            const call = response.data.data;
            logger.info(`✅ [TELNYX] CALL CREATED SUCCESSFULLY!`);
            logger.info(`✅ [TELNYX] Call Control ID: ${call.call_control_id}`);
            logger.info(`✅ [TELNYX] Status: Call is now DIALING customer...`);
            logger.info(`✅ [TELNYX] Next Steps:`);
            logger.info(`   1️⃣  Telnyx is calling: ${contact.phone}`);
            logger.info(`   2️⃣  When customer answers → call.answered webhook`);
            logger.info(`   3️⃣  System sends ANSWER command`);
            logger.info(`   4️⃣  AI conversation starts automatically`);
            logger.info(`📞 [TELNYX] ============================================`);

            return {
                success: true,
                callControlId: call.call_control_id,
                telnyxCallId: call.call_control_id,
                callId
            };

        } catch (error) {
            logger.error(`❌ [TELNYX] Failed to initiate call for ${contact.phone}:`, error.message);
            
            // Enhanced error handling with specific error codes
            if (error.response) {
                const errorData = error.response.data;
                logger.error(`   Telnyx API Error: ${JSON.stringify(errorData)}`);
                
                // Check for specific error codes
                if (errorData.errors && errorData.errors.length > 0) {
                    const firstError = errorData.errors[0];
                    
                    if (firstError.code === '10009') {
                        // Authentication failed - API key is invalid
                        const enhancedError = new Error(
                            'Telnyx API authentication failed. Your API key is invalid or malformed. ' +
                            'Please check your TELNYX_API_KEY environment variable. ' +
                            'Get a valid key from https://portal.telnyx.com/#/app/api-keys'
                        );
                        enhancedError.code = 'TELNYX_AUTH_FAILED';
                        enhancedError.originalError = error;
                        throw enhancedError;
                    } else if (firstError.code === '10007') {
                        // Invalid connection ID
                        const enhancedError = new Error(
                            'Telnyx connection ID is invalid. Please check your TELNYX_CONNECTION_ID environment variable.'
                        );
                        enhancedError.code = 'TELNYX_INVALID_CONNECTION';
                        enhancedError.originalError = error;
                        throw enhancedError;
                    }
                }
            }
            
            throw error;
        }
    }

    /**
     * Play audio to customer
     * @param {string} callControlId - Telnyx call control ID
     * @param {string} audioUrl - Public URL to audio file (must be accessible by Telnyx)
     */
    async playAudio(callControlId, audioUrl) {
        try {
            logger.info(`🔊 [TELNYX] Playing audio to call ${callControlId}`);
            logger.info(`   Audio URL: ${audioUrl}`);

            await telnyx.calls.playback_start(callControlId, {
                audio_url: audioUrl,
                overlay: false
            });

            logger.info(`✅ [TELNYX] Audio playback started successfully`);
            return { success: true };

        } catch (error) {
            logger.error(`❌ [TELNYX] Failed to play audio on call ${callControlId}:`, error.message);
            throw error;
        }
    }

    /**
     * Speak text to customer using Telnyx TTS (alternative to Piper)
     * Note: This uses Telnyx TTS which costs money. Use playAudio with Piper instead for free.
     */
    async speakText(callControlId, text, voice = 'female', language = 'en-US') {
        try {
            await telnyx.calls.speak(callControlId, {
                payload: text,
                voice: voice,
                language: language
            });

            logger.info(`🗣️  Speaking text to call ${callControlId}`);
            return { success: true };

        } catch (error) {
            logger.error(`❌ Failed to speak on call ${callControlId}:`, error.message);
            throw error;
        }
    }

    /**
     * Start recording customer speech
     */
    async startRecording(callControlId, maxLength = 10) {
        try {
            const recording = await telnyx.calls.record_start(callControlId, {
                format: 'wav',
                channels: 'single',
                max_length: maxLength,
                // Stop on silence
                play_beep: false
            });

            logger.info(`🎙️  Started recording on call ${callControlId}`);
            return { success: true, recording };

        } catch (error) {
            logger.error(`❌ Failed to start recording on call ${callControlId}:`, error.message);
            throw error;
        }
    }

    /**
     * Stop recording
     */
    async stopRecording(callControlId) {
        try {
            await telnyx.calls.record_stop(callControlId);
            logger.info(`⏹️  Stopped recording on call ${callControlId}`);
            return { success: true };

        } catch (error) {
            logger.error(`❌ Failed to stop recording on call ${callControlId}:`, error.message);
            throw error;
        }
    }

    /**
     * Download recording from Telnyx
     */
    async downloadRecording(recordingUrl) {
        try {
            const response = await axios.get(recordingUrl, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`
                },
                responseType: 'arraybuffer'
            });

            logger.info(`📥 Downloaded recording from Telnyx`);
            return response.data;

        } catch (error) {
            logger.error(`❌ Failed to download recording:`, error.message);
            throw error;
        }
    }

    /**
     * Hangup call
     */
    async hangupCall(callControlId) {
        try {
            await telnyx.calls.hangup(callControlId);
            logger.info(`📴 Hung up call ${callControlId}`);
            return { success: true };

        } catch (error) {
            logger.error(`❌ Failed to hangup call ${callControlId}:`, error.message);
            // Don't throw - call might already be disconnected
            return { success: false, error: error.message };
        }
    }

    /**
     * Answer incoming call (for future use if handling inbound)
     */
    async answerCall(callControlId) {
        try {
            logger.info(`📞 [TELNYX] Sending ANSWER command to Telnyx for call ${callControlId}`);
            await telnyx.calls.answer(callControlId);
            logger.info(`✅ [TELNYX] Call ${callControlId} answered successfully - Connection established!`);
            logger.info(`🤖 [TELNYX] AI is now ready to talk to customer`);
            return { success: true };

        } catch (error) {
            logger.error(`❌ [TELNYX] Failed to answer call ${callControlId}:`, error.message);
            throw error;
        }
    }

    /**
     * Get call status
     */
    async getCallStatus(callControlId) {
        try {
            const call = await telnyx.calls.retrieve(callControlId);
            return call;

        } catch (error) {
            logger.error(`❌ Failed to get call status ${callControlId}:`, error.message);
            throw error;
        }
    }

    /**
     * Bridge two calls together (for warm transfers - future use)
     */
    async bridgeCalls(callControlId1, callControlId2) {
        try {
            await telnyx.calls.bridge(callControlId1, {
                call_control_id: callControlId2
            });

            logger.info(`🌉 Bridged calls ${callControlId1} and ${callControlId2}`);
            return { success: true };

        } catch (error) {
            logger.error(`❌ Failed to bridge calls:`, error.message);
            throw error;
        }
    }
}

module.exports = new TelnyxCallControl();
