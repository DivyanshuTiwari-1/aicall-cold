const logger = require('../utils/logger');
const { startOutboundCall: asteriskStartOutboundCall } = require('./telephony/providers/asterisk');

/**
 * Telephony Service
 * Handles outbound call initiation through various providers
 */

async function startOutboundCall({ callId, organizationId, campaignId, contactId, toPhone, automated = false }) {
    try {
        logger.info(`Starting outbound call: ${callId} to ${toPhone} (automated: ${automated})`);

        // Use existing Asterisk provider for real telephony
        const result = await asteriskStartOutboundCall({
            callId: callId,
            toPhone: toPhone
        });

        logger.info(`Call ${callId} initiated successfully to ${toPhone}`);

        return {
            success: true,
            callId: callId,
            status: 'initiated',
            message: 'Call initiated successfully',
            provider: result.provider
        };

    } catch (error) {
        logger.error(`Failed to start outbound call ${callId}:`, error);
        throw error;
    }
}

async function endCall(callId) {
    try {
        logger.info(`Ending call: ${callId}`);

        // Clean up any active bridges for this call
        const { cleanupBridge } = require('./telephony/providers/asterisk');
        await cleanupBridge(callId);

        return {
            success: true,
            callId: callId,
            status: 'ended'
        };

    } catch (error) {
        logger.error(`Failed to end call ${callId}:`, error);
        throw error;
    }
}

async function muteCall(callId) {
    try {
        logger.info(`Muting call: ${callId}`);

        // For now, return success - mute functionality would need ARI channel control
        return {
            success: true,
            callId: callId,
            status: 'muted'
        };

    } catch (error) {
        logger.error(`Failed to mute call ${callId}:`, error);
        throw error;
    }
}

async function unmuteCall(callId) {
    try {
        logger.info(`Unmuting call: ${callId}`);

        // For now, return success - unmute functionality would need ARI channel control
        return {
            success: true,
            callId: callId,
            status: 'unmuted'
        };

    } catch (error) {
        logger.error(`Failed to unmute call ${callId}:`, error);
        throw error;
    }
}

module.exports = {
    startOutboundCall,
    endCall,
    muteCall,
    unmuteCall
};
