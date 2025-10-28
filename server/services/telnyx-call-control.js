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
     * Initiate automated AI call via Telnyx
     */
    async makeAICall({ callId, contact, campaignId, fromNumber }) {
        try {
            if (!this.apiKey || !this.connectionId) {
                throw new Error('Telnyx not configured');
            }

            // Prepare metadata to send with call
            const metadata = {
                callId,
                contactId: contact.id,
                campaignId,
                organizationId: contact.organization_id,
                contactName: `${contact.first_name} ${contact.last_name}`,
                automated: true
            };

            // Encode metadata as base64 for client_state
            const clientState = Buffer.from(JSON.stringify(metadata)).toString('base64');

            logger.info(`📞 Initiating Telnyx call: ${callId} to ${contact.phone}`);

            // Create call via Telnyx Call Control API using axios
            const response = await axios.post('https://api.telnyx.com/v2/calls', {
                connection_id: this.connectionId,
                to: contact.phone,
                from: fromNumber || this.phoneNumber,
                webhook_url: this.webhookUrl,
                webhook_url_method: 'POST',
                client_state: clientState,
                timeout_secs: 30
            }, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            const call = response.data.data;
            logger.info(`✅ Telnyx call created: ${call.call_control_id}`);

            return {
                success: true,
                callControlId: call.call_control_id,
                telnyxCallId: call.call_control_id,
                callId
            };

        } catch (error) {
            logger.error(`❌ Failed to initiate Telnyx call for ${contact.phone}:`, error.message);
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
            await telnyx.calls.playback_start(callControlId, {
                audio_url: audioUrl,
                overlay: false
            });

            logger.info(`🔊 Playing audio to call ${callControlId}`);
            return { success: true };

        } catch (error) {
            logger.error(`❌ Failed to play audio on call ${callControlId}:`, error.message);
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
            await telnyx.calls.answer(callControlId);
            logger.info(`✅ Answered call ${callControlId}`);
            return { success: true };

        } catch (error) {
            logger.error(`❌ Failed to answer call ${callControlId}:`, error.message);
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
