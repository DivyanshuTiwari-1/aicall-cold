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

async function startOutboundCall({ callId, toPhone }) {
    // Originate call via Asterisk ARI to Telnyx endpoint
    const client = await connectAri();
    try {
        // Use telnyx_endpoint from pjsip.conf
        const endpoint = `PJSIP/${toPhone}@telnyx_endpoint`;

        await client.channels.originate({
            endpoint: endpoint,
            app: 'ai-dialer-stasis',
            appArgs: [callId, toPhone, 'automated'].join(','),
            callerId: process.env.TELNYX_DID || '+12025550123'
        });

        logger.info(`✅ ARI originate requested for ${toPhone} via Telnyx, callId: ${callId}`);
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

async function startManualCall({ callId, agentExtension, toPhone, contactId }) {
    const client = await connectAri();
    try {
        logger.info(`Starting manual call: ${callId}, agent: ${agentExtension}, to: ${toPhone}`);

        // Step 1: Call agent first
        const agentChannel = await client.channels.originate({
            endpoint: `PJSIP/${agentExtension}`,
            app: 'manual-dialer-bridge-stasis',
            appArgs: [callId, contactId].join(','),
            callerId: 'Internal Call'
        });

        // Step 2: When agent answers, dial customer
        agentChannel.on('StasisStart', async() => {
            try {
                logger.info(`Agent ${agentExtension} answered, now dialing customer ${toPhone}`);

                const customerChannel = await client.channels.originate({
                    endpoint: `PJSIP/${toPhone}@telnyx_endpoint`,
                    app: 'manual-dialer-bridge-stasis',
                    appArgs: [callId, contactId].join(','),
                    callerId: process.env.TELNYX_DID || '+12025550123'
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
        logger.error(`❌ Manual call error for ${callId}:`, e.message);
        throw e;
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

module.exports = { startOutboundCall, startManualCall };
