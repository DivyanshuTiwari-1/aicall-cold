const AriClient = require('ari-client');
const logger = require('../../../utils/logger');

const ARI_URL = process.env.ARI_URL || 'http://localhost:8088';
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
    // Minimal stub: originate a call via Stasis app "ai-dialer"
    const client = await connectAri();
    try {
        await client.channels.originate({
            endpoint: `PJSIP/${toPhone}`,
            app: 'ai-dialer',
            appArgs: callId
        });
        logger.info(`ARI originate requested for ${toPhone} callId ${callId}`);
        return { requested: true };
    } catch (e) {
        logger.error('ARI originate error', e);
        throw e;
    }
}

module.exports = { startOutboundCall };