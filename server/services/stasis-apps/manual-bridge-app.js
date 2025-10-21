const logger = require('../../utils/logger');

class ManualBridgeStasisApp {
    constructor(ariClient) {
        this.ari = ariClient;
        this.activeBridges = new Map();
        this.agentChannels = new Map();
        this.customerChannels = new Map();
        this.setupEventHandlers();
    }

    setupEventHandlers() {
        // Handle StasisStart events for manual bridge calls
        this.ari.on('StasisStart', (event, channel) => {
            if (event.application === 'manual-dialer-bridge-stasis') {
                this.handleManualCallStart(event, channel);
            }
        });

        // Handle channel destruction
        this.ari.on('ChannelDestroyed', (event, channel) => {
            this.handleChannelDestroyed(event, channel);
        });

        // Handle bridge events
        this.ari.on('BridgeCreated', (event, bridge) => {
            this.handleBridgeCreated(event, bridge);
        });

        this.ari.on('BridgeDestroyed', (event, bridge) => {
            this.handleBridgeDestroyed(event, bridge);
        });

        logger.info('Manual Bridge Stasis App event handlers registered');
    }

    async handleManualCallStart(event, channel) {
        try {
            const args = event.args || [];
            const callId = args[0];
            const contactId = args[1];

            logger.info(`Manual bridge call started: ${callId}, Contact: ${contactId}`);

            // Store channel information
            this.agentChannels.set(channel.id, {
                callId,
                contactId,
                channelId: channel.id,
                startTime: new Date(),
                status: 'agent_connected'
            });

            // Answer the agent channel
            await this.ari.channels.answer({ channelId: channel.id });

            // Log agent connection
            await this.logCallEvent(callId, 'agent_connected', {
                contactId,
                channelId: channel.id
            });

            // Wait for agent to be ready, then dial customer
            // In a real implementation, you might wait for a DTMF signal or timer
            setTimeout(() => {
                this.dialCustomer(callId, contactId, channel.id);
            }, 2000); // 2 second delay for agent to get ready

        } catch (error) {
            logger.error('Error in manual call start handler:', error);
            await this.handleCallError(channel.id, error);
        }
    }

    async dialCustomer(callId, contactId, agentChannelId) {
        try {
            // Get contact phone number from database
            const contactInfo = await this.getContactInfo(contactId);
            if (!contactInfo) {
                throw new Error(`Contact ${contactId} not found`);
            }

            logger.info(`Dialing customer ${contactInfo.phone} for call ${callId}`);

            // Originate call to customer
            const customerChannel = await this.ari.channels.originate({
                endpoint: `PJSIP/${contactInfo.phone}@telnyx_endpoint`,
                app: 'manual-dialer-bridge-stasis',
                appArgs: [callId, contactId].join(','),
                callerId: process.env.TELNYX_DID || '+12025550123'
            });

            // Store customer channel info
            this.customerChannels.set(customerChannel.id, {
                callId,
                contactId,
                phone: contactInfo.phone,
                channelId: customerChannel.id,
                agentChannelId: agentChannelId,
                startTime: new Date(),
                status: 'dialing'
            });

            // Set up customer channel event handlers
            this.setupCustomerChannelHandlers(customerChannel, callId, contactId, agentChannelId);

        } catch (error) {
            logger.error(`Failed to dial customer for call ${callId}:`, error);
            await this.handleCallError(agentChannelId, error);
        }
    }

    setupCustomerChannelHandlers(customerChannel, callId, contactId, agentChannelId) {
        customerChannel.on('StasisStart', async () => {
            try {
                logger.info(`Customer answered for call ${callId}, creating bridge`);

                // Update customer channel status
                const customerInfo = this.customerChannels.get(customerChannel.id);
                if (customerInfo) {
                    customerInfo.status = 'answered';
                }

                // Create bridge to connect agent and customer
                await this.createBridge(callId, agentChannelId, customerChannel.id);

            } catch (error) {
                logger.error(`Error handling customer answer for call ${callId}:`, error);
            }
        });

        customerChannel.on('ChannelDestroyed', () => {
            logger.info(`Customer channel destroyed for call ${callId}`);
            this.cleanupCall(callId);
        });
    }

    async createBridge(callId, agentChannelId, customerChannelId) {
        try {
            // Create a mixing bridge
            const bridge = await this.ari.bridges.create({
                type: 'mixing'
            });

            // Add both channels to the bridge
            await this.ari.bridges.addChannel({
                bridgeId: bridge.id,
                channel: agentChannelId
            });

            await this.ari.bridges.addChannel({
                bridgeId: bridge.id,
                channel: customerChannelId
            });

            // Store bridge information
            this.activeBridges.set(callId, {
                bridgeId: bridge.id,
                agentChannelId,
                customerChannelId,
                startTime: new Date(),
                status: 'bridged'
            });

            logger.info(`Bridge created for call ${callId}: ${bridge.id}`);

            // Log bridge creation
            await this.logCallEvent(callId, 'bridge_created', {
                bridgeId: bridge.id,
                agentChannelId,
                customerChannelId
            });

        } catch (error) {
            logger.error(`Failed to create bridge for call ${callId}:`, error);
            throw error;
        }
    }

    async handleChannelDestroyed(event, channel) {
        const agentInfo = this.agentChannels.get(channel.id);
        const customerInfo = this.customerChannels.get(channel.id);

        if (agentInfo) {
            logger.info(`Agent channel destroyed for call ${agentInfo.callId}`);
            this.cleanupCall(agentInfo.callId);
        }

        if (customerInfo) {
            logger.info(`Customer channel destroyed for call ${customerInfo.callId}`);
            this.cleanupCall(customerInfo.callId);
        }
    }

    async handleBridgeCreated(event, bridge) {
        logger.debug(`Bridge created: ${bridge.id}`);
    }

    async handleBridgeDestroyed(event, bridge) {
        logger.debug(`Bridge destroyed: ${bridge.id}`);

        // Find and clean up the call associated with this bridge
        for (const [callId, bridgeInfo] of this.activeBridges.entries()) {
            if (bridgeInfo.bridgeId === bridge.id) {
                this.cleanupCall(callId);
                break;
            }
        }
    }

    async cleanupCall(callId) {
        try {
            const bridgeInfo = this.activeBridges.get(callId);
            if (bridgeInfo) {
                // Calculate call duration
                const duration = Date.now() - bridgeInfo.startTime.getTime();

                // Log call completion
                await this.logCallEvent(callId, 'call_completed', {
                    duration,
                    bridgeId: bridgeInfo.bridgeId
                });

                // Clean up bridge
                try {
                    await this.ari.bridges.destroy({ bridgeId: bridgeInfo.bridgeId });
                } catch (error) {
                    logger.warn(`Failed to destroy bridge ${bridgeInfo.bridgeId}:`, error);
                }

                this.activeBridges.delete(callId);
            }

            // Clean up channel references
            for (const [channelId, info] of this.agentChannels.entries()) {
                if (info.callId === callId) {
                    this.agentChannels.delete(channelId);
                }
            }

            for (const [channelId, info] of this.customerChannels.entries()) {
                if (info.callId === callId) {
                    this.customerChannels.delete(channelId);
                }
            }

            logger.info(`Call ${callId} cleanup completed`);

        } catch (error) {
            logger.error(`Error cleaning up call ${callId}:`, error);
        }
    }

    async handleCallError(channelId, error) {
        const agentInfo = this.agentChannels.get(channelId);
        const customerInfo = this.customerChannels.get(channelId);

        const callId = agentInfo?.callId || customerInfo?.callId;
        if (callId) {
            logger.error(`Call error for ${callId}:`, error);

            // Log error to database
            await this.logCallEvent(callId, 'call_error', {
                error: error.message,
                channelId: channelId
            });

            // Clean up the call
            this.cleanupCall(callId);
        }
    }

    async getContactInfo(contactId) {
        try {
            // Make API call to get contact information
            const response = await fetch(`http://localhost:3000/api/v1/contacts/${contactId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to get contact info: ${response.status}`);
            }

            const contact = await response.json();
            return contact.data;

        } catch (error) {
            logger.error(`Error getting contact info for ${contactId}:`, error);
            return null;
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

    getActiveBridges() {
        return Array.from(this.activeBridges.values());
    }

    getBridgeInfo(callId) {
        return this.activeBridges.get(callId);
    }
}

module.exports = ManualBridgeStasisApp;

