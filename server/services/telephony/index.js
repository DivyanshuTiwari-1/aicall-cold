const logger = require('../../utils/logger');

let provider;

try {
    const voiceStack = (process.env.VOICE_STACK || 'saas').toLowerCase();
    if (voiceStack === 'self_hosted') {
        // Self-hosted via Asterisk ARI
        provider = require('./providers/asterisk');
        logger.info('Telephony provider: Asterisk ARI (self_hosted)');
    } else {
        // SaaS fallback (Twilio)
        provider = require('./providers/twilio');
        logger.info('Telephony provider: Twilio (saas)');
    }
} catch (err) {
    logger.error('Failed to initialize telephony provider', err);
}

async function startOutboundCall(params) {
    if (!provider || !provider.startOutboundCall) {
        throw new Error('Telephony provider not available');
    }
    return provider.startOutboundCall(params);
}

module.exports = {
    startOutboundCall
};