const twilio = require('twilio');
const logger = require('../../../utils/logger');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_PHONE_NUMBER;

let client;
if (accountSid && authToken) {
    client = twilio(accountSid, authToken);
}

async function startOutboundCall({ callId, toPhone }) {
    if (!client || !fromNumber) {
        logger.warn('Twilio not configured, simulating call start');
        return { simulated: true };
    }
    try {
        const call = await client.calls.create({
            url: 'http://demo.twilio.com/docs/voice.xml',
            to: toPhone,
            from: fromNumber
        });
        logger.info(`Twilio call started: ${call.sid} for callId ${callId}`);
        return { sid: call.sid };
    } catch (e) {
        logger.error('Twilio startOutboundCall error', e);
        throw e;
    }
}

module.exports = { startOutboundCall };