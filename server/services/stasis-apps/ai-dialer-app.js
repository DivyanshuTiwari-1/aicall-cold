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
            // Execute the AGI script for AI conversation
            const agiResult = await this.ari.channels.continueInDialplan({
                channelId: channelId,
                context: 'ai-dialer',
                extension: phoneNumber,
                priority: 1,
                variables: {
                    'CALL_ID': callId,
                    'CONTACT_PHONE': phoneNumber,
                    'CAMPAIGN_ID': campaignId
                }
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
            logger.info(`AI call ended: ${callInfo.callId}, Duration: ${Date.now() - callInfo.startTime.getTime()}ms`);

            // Log call end to database
            await this.logCallEvent(callInfo.callId, 'ai_call_ended', {
                duration: Date.now() - callInfo.startTime.getTime(),
                reason: event.cause || 'normal',
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

