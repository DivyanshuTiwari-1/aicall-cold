const logger = require('../../utils/logger');

class AiDialerStasisApp {
    constructor(ariClient) {
        this.ari = ariClient;
        this.activeCalls = new Map();
        this.setupEventHandlers();
    }

    setupEventHandlers() {
        // Handle StasisStart events for AI dialer calls
        this.ari.on('StasisStart', (event, channel) => {
            if (event.application === 'ai-dialer-stasis') {
                this.handleAiCallStart(event, channel);
            }
        });

        // Handle channel destruction
        this.ari.on('ChannelDestroyed', (event, channel) => {
            this.handleChannelDestroyed(event, channel);
        });

        // Handle channel state changes
        this.ari.on('ChannelStateChange', (event, channel) => {
            this.handleChannelStateChange(event, channel);
        });

        logger.info('AI Dialer Stasis App event handlers registered');
    }

    async handleAiCallStart(event, channel) {
        try {
            const args = event.args || [];
            const callId = args[0];
            const phoneNumber = args[1];
            const campaignId = args[2];

            logger.info(`AI Dialer call started: ${callId}, Phone: ${phoneNumber}, Campaign: ${campaignId}`);

            // Store call information
            this.activeCalls.set(channel.id, {
                callId,
                phoneNumber,
                campaignId,
                channelId: channel.id,
                startTime: new Date(),
                status: 'active'
            });

            // Answer the channel
            await this.ari.channels.answer({ channelId: channel.id });

            // Log call start to database
            await this.logCallEvent(callId, 'ai_call_started', {
                phoneNumber,
                campaignId,
                channelId: channel.id
            });

            // Start the AGI script for AI conversation
            await this.startAiConversation(channel.id, callId, phoneNumber, campaignId);

        } catch (error) {
            logger.error('Error in AI call start handler:', error);
            await this.handleCallError(channel.id, error);
        }
    }

    async startAiConversation(channelId, callId, phoneNumber, campaignId) {
        try {
            // Set channel variables for the AGI script
            await this.ari.channels.setChannelVar({
                channelId: channelId,
                variable: 'CALL_ID',
                value: callId
            });

            await this.ari.channels.setChannelVar({
                channelId: channelId,
                variable: 'CONTACT_PHONE',
                value: phoneNumber
            });

            await this.ari.channels.setChannelVar({
                channelId: channelId,
                variable: 'CAMPAIGN_ID',
                value: campaignId || 'unknown'
            });

            // Execute the AGI script directly with proper arguments
            // The AGI script path should be relative to Asterisk's AGI directory
            const agiScript = 'ai-dialer-agi-simple.php';
            const agiArgs = `${callId},${phoneNumber},${campaignId || 'unknown'}`;

            logger.info(`Executing AGI: ${agiScript} with args: ${agiArgs}`);

            // Continue to dialplan context that will execute AGI
            await this.ari.channels.continueInDialplan({
                channelId: channelId,
                context: 'ai-dialer-stasis',
                extension: 's',
                priority: 1
            });

            logger.info(`AGI script started for call ${callId}`);

        } catch (error) {
            logger.error(`Failed to start AGI script for call ${callId}:`, error);
            throw error;
        }
    }

    async handleChannelDestroyed(event, channel) {
        const callInfo = this.activeCalls.get(channel.id);
        if (callInfo) {
            const durationMs = Date.now() - callInfo.startTime.getTime();
            const durationSeconds = Math.floor(durationMs / 1000);

            logger.info(`AI call ended: ${callInfo.callId}, Duration: ${durationSeconds}s`);

            // Calculate cost
            const TELNYX_RATE_PER_MINUTE = 0.011;
            const callCost = (durationSeconds / 60) * TELNYX_RATE_PER_MINUTE;

            // Determine outcome from hangup cause
            let outcome = 'completed';
            const cause = event.cause || event.cause_txt || '';

            if (cause.includes('NO_ANSWER') || cause.includes('NO ANSWER')) {
                outcome = 'no_answer';
            } else if (cause.includes('BUSY')) {
                outcome = 'busy';
            } else if (cause.includes('NORMAL') || durationSeconds > 30) {
                outcome = 'completed';
            }

            // Update call status directly in database
            try {
                const { query } = require('../../config/database');

                // Get aggregated transcript from call_events BEFORE updating
                const transcriptResult = await query(`
                    SELECT event_data
                    FROM call_events
                    WHERE call_id = $1 AND event_type = 'ai_conversation'
                    ORDER BY timestamp ASC
                `, [callInfo.callId]);

                let fullTranscript = '';
                transcriptResult.rows.forEach(row => {
                    const data = row.event_data;
                    if (data.user_input) {
                        fullTranscript += `Customer: ${data.user_input}\n`;
                    }
                    if (data.ai_response) {
                        fullTranscript += `AI: ${data.ai_response}\n`;
                    }
                });

                // Update call with final data (only if not already completed)
                await query(`
                    UPDATE calls
                    SET
                        status = 'completed',
                        outcome = $1,
                        duration = $2,
                        cost = $3,
                        transcript = $4,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = $5 AND status != 'completed'
                `, [outcome, durationSeconds, callCost, fullTranscript || null, callInfo.callId]);

                logger.info(`✅ Call ${callInfo.callId} marked as completed with outcome: ${outcome}`);
            } catch (dbError) {
                logger.error(`Failed to update call status for ${callInfo.callId}:`, dbError);
            }

            // Log call end event
            await this.logCallEvent(callInfo.callId, 'ai_call_ended', {
                duration: durationSeconds,
                durationMs: durationMs,
                reason: cause || 'normal',
                outcome: outcome,
                channelId: channel.id
            });

            // Clean up
            this.activeCalls.delete(channel.id);
        }
    }

    async handleChannelStateChange(event, channel) {
        const callInfo = this.activeCalls.get(channel.id);
        if (callInfo) {
            logger.debug(`Channel state changed for call ${callInfo.callId}: ${event.channel.state}`);

            // Log state changes
            await this.logCallEvent(callInfo.callId, 'channel_state_change', {
                state: event.channel.state,
                channelId: channel.id
            });
        }
    }

    async handleCallError(channelId, error) {
        const callInfo = this.activeCalls.get(channelId);
        if (callInfo) {
            logger.error(`Call error for ${callInfo.callId}:`, error);

            // Log error to database
            await this.logCallEvent(callInfo.callId, 'call_error', {
                error: error.message,
                channelId: channelId
            });

            // Try to hang up the channel
            try {
                await this.ari.channels.hangup({ channelId: channelId });
            } catch (hangupError) {
                logger.error('Failed to hang up channel after error:', hangupError);
            }

            // Clean up
            this.activeCalls.delete(channelId);
        }
    }

    async logCallEvent(callId, eventType, eventData) {
        try {
            // Make API call to log the event
            const response = await fetch('http://localhost:3000/api/v1/asterisk/call-event', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    callId,
                    eventType,
                    eventData,
                    timestamp: new Date().toISOString()
                })
            });

            if (!response.ok) {
                logger.warn(`Failed to log call event: ${response.status}`);
            }
        } catch (error) {
            logger.error('Error logging call event:', error);
        }
    }

    getActiveCalls() {
        return Array.from(this.activeCalls.values());
    }

    getCallInfo(channelId) {
        return this.activeCalls.get(channelId);
    }
}

module.exports = AiDialerStasisApp;
