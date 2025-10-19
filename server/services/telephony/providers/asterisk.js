const AriClient = require('ari-client');
const logger = require('../../../utils/logger');

const ARI_URL = process.env.ARI_URL || 'http://localhost:8088/ari';
const ARI_USER = process.env.ARI_USER || 'ari_user';
const ARI_PASS = process.env.ARI_PASS || 'ari_password';

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
            app: 'ai-dialer',
            appArgs: callId,
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

module.exports = { startOutboundCall };