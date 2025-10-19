const logger = require('../../utils/logger');

let provider;

try {
    const voiceStack = (process.env.VOICE_STACK || 'self_hosted').toLowerCase();

    logger.info(`Voice Stack Configuration: ${voiceStack}`);

    if (voiceStack === 'self_hosted') {
        // Self-hosted via Asterisk ARI + Telnyx
        provider = require('./providers/asterisk');
        logger.info('✅ Telephony provider: Asterisk ARI (self_hosted with Telnyx)');
    } else {
        // SaaS fallback (Twilio) - Not recommended
        provider = require('./providers/twilio');
        logger.warn('⚠️  Telephony provider: Twilio (saas) - Switch to self_hosted for cost savings!');
    }
} catch (err) {
    logger.error('❌ Failed to initialize telephony provider', err);
    // Fallback to asterisk if available
    try {
        provider = require('./providers/asterisk');
        logger.info('Fallback: Using Asterisk provider');
    } catch (fallbackErr) {
        logger.error('No telephony provider available!');
    }
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
