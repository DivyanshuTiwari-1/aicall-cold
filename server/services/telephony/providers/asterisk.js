const AriClient = require('ari-client');
const logger = require('../../../utils/logger');

const ARI_URL = process.env.ARI_URL || 'http://localhost:8088/ari';
const ARI_USER = process.env.ARI_USERNAME || process.env.ARI_USER || 'ai-dialer';
const ARI_PASS = process.env.ARI_PASSWORD || process.env.ARI_PASS || 'ai-dialer-password';

let ari;

async function connectAri() {
    if (ari) return ari;
    try {
        ari = await AriClient.connect(ARI_URL, ARI_USER, ARI_PASS);
        logger.info('Connected to Asterisk ARI');
        return ari;
    } catch (e) {
        logger.error('ARI connection failed', e);
        throw e;
    }
}

async function startOutboundCall({ callId, toPhone, campaignId }) {
    // Originate call via Asterisk ARI to Telnyx endpoint
    const client = await connectAri();
    try {
        // Use telnyx_outbound from pjsip.conf
        const endpoint = `PJSIP/${toPhone}@telnyx_outbound`;

        await client.channels.originate({
            endpoint: endpoint,
            app: 'ai-dialer-stasis',
            appArgs: [callId, toPhone, campaignId || 'unknown'].join(','),
            callerId: process.env.TELNYX_DID || '+12025550123'
        });

        logger.info(`✅ ARI originate requested for ${toPhone} via Telnyx, callId: ${callId}, campaignId: ${campaignId}`);
        return {
            success: true,
            callId: callId,
            toPhone: toPhone,
            provider: 'telnyx'
        };
    } catch (e) {
        logger.error(`❌ ARI originate error for ${toPhone}:`, e.message);
        throw e;
    }
}

async function startManualCall({ callId, agentExtension, agentUserId, toPhone, contactId, fromNumber }) {
    try {
        const client = await connectAri();
        logger.info(`Starting manual call: ${callId}, agent: ${agentExtension}, to: ${toPhone}, from: ${fromNumber || 'env default'}`);

        // Verify agent extension exists
        if (!agentExtension) {
            throw new Error('Agent SIP extension not configured');
        }

        // Validate required parameters
        if (!agentUserId) {
            throw new Error('Agent user ID is required');
        }

        if (!toPhone) {
            throw new Error('Phone number is required');
        }

        // Use assigned phone number or fall back to env variable
        const callerIdNumber = fromNumber || process.env.TELNYX_DID || '+12025550123';

        // Check if agent endpoint is registered
        const agentEndpointName = `PJSIP/agent_${agentUserId}`;
        logger.info(`Checking agent endpoint: ${agentEndpointName}`);

        try {
            const endpoints = await client.endpoints.list();
            const agentEndpoint = endpoints.find(ep => ep.resource === `agent_${agentUserId}`);

            if (!agentEndpoint) {
                throw new Error(`SIP_NOT_CONFIGURED: Agent SIP endpoint not found. Please configure SIP extension ${agentExtension}.`);
            }

            if (agentEndpoint.state === 'offline' || agentEndpoint.state === 'unknown') {
                throw new Error(`SIP_OFFLINE: Agent SIP phone is not registered. Please login to your softphone with extension ${agentExtension}.`);
            }

            logger.info(`✅ Agent endpoint ${agentEndpoint.resource} is ${agentEndpoint.state}`);
        } catch (endpointError) {
            if (endpointError.message.startsWith('SIP_')) {
                throw endpointError;
            }
            logger.warn('Could not verify endpoint status, proceeding with call attempt:', endpointError.message);
        }

        logger.info(`Originating call to agent: ${agentEndpointName}`);

        // Step 1: Call agent first
        // Use the user ID to construct the correct endpoint name
        // The endpoint is named agent_{USER_ID}, not agent_{EXTENSION}
        const agentChannel = await client.channels.originate({
            endpoint: agentEndpointName,
            app: 'manual-dialer-bridge-stasis',
            appArgs: [callId, contactId].join(','),
            callerId: 'Internal Call',
            timeout: 30
        });

        // Step 2: When agent answers, dial customer
        agentChannel.on('StasisStart', async() => {
            try {
                logger.info(`Agent ${agentExtension} answered, now dialing customer ${toPhone}`);

                const customerChannel = await client.channels.originate({
                    endpoint: `PJSIP/${toPhone}@telnyx_outbound`,
                    app: 'manual-dialer-bridge-stasis',
                    appArgs: [callId, contactId].join(','),
                    callerId: callerIdNumber
                });

                // Step 3: Bridge both channels when customer answers
                customerChannel.on('StasisStart', async() => {
                    try {
                        logger.info(`Customer ${toPhone} answered, bridging with agent ${agentExtension}`);

                        const bridge = await client.bridges.create({ type: 'mixing' });
                        await bridge.addChannel({ channel: agentChannel.id });
                        await bridge.addChannel({ channel: customerChannel.id });

                        // Store bridge reference for cleanup
                        global.activeBridges = global.activeBridges || new Map();
                        global.activeBridges.set(callId, bridge.id);

                        logger.info(`✅ Manual call bridged successfully: ${callId}`);
                    } catch (bridgeError) {
                        logger.error(`❌ Bridge creation error for ${callId}:`, bridgeError);
                    }
                });

                customerChannel.on('ChannelDestroyed', () => {
                    logger.info(`Customer channel destroyed for call ${callId}`);
                    cleanupBridge(callId);
                });

            } catch (customerError) {
                logger.error(`❌ Customer dial error for ${callId}:`, customerError);
            }
        });

        agentChannel.on('ChannelDestroyed', () => {
            logger.info(`Agent channel destroyed for call ${callId}`);
            cleanupBridge(callId);
        });

        logger.info(`✅ Manual call initiated: ${callId}`);
        return {
            success: true,
            callId: callId,
            agentExtension: agentExtension,
            toPhone: toPhone,
            provider: 'asterisk'
        };

    } catch (e) {
        logger.error(`❌ Manual call error for ${callId}:`, e);

        // Provide more specific error messages
        if (e.message && e.message.startsWith('SIP_')) {
            // Already has user-friendly message
            throw new Error(e.message.replace(/^SIP_[A-Z_]+:\s*/, ''));
        } else if (e.message && e.message.includes('ECONNREFUSED')) {
            throw new Error('Unable to connect to Asterisk. Please ensure Asterisk is running.');
        } else if (e.message && (e.message.includes('endpoint') || e.message.includes('not found'))) {
            throw new Error(`SIP endpoint not available. Please ensure you are logged into your softphone with extension ${agentExtension}.`);
        } else if (e.message && e.message.includes('timeout')) {
            throw new Error('Agent phone did not answer. Please ensure your softphone is open and ready.');
        } else if (e.message && e.message.includes('Originate')) {
            throw new Error(`Unable to place call. Please ensure your softphone is logged in with extension ${agentExtension}.`);
        } else {
            throw new Error(e.message || 'Failed to initiate manual call via telephony provider');
        }
    }
}

async function cleanupBridge(callId) {
    try {
        if (global.activeBridges && global.activeBridges.has(callId)) {
            const bridgeId = global.activeBridges.get(callId);
            const client = await connectAri();
            await client.bridges.destroy({ bridgeId });
            global.activeBridges.delete(callId);
            logger.info(`Bridge ${bridgeId} cleaned up for call ${callId}`);
        }
    } catch (error) {
        logger.error(`Error cleaning up bridge for call ${callId}:`, error);
    }
}

module.exports = { startOutboundCall, startManualCall, cleanupBridge, connectAri };
