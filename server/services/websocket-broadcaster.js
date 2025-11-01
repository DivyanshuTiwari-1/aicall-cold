const logger = require('../utils/logger');

/**
 * WebSocket Broadcasting Service
 * Centralized service for broadcasting real-time events
 * Integrates with global WebSocket broadcast functions
 */

class WebSocketBroadcaster {
    /**
     * Broadcast call started event
     */
    static broadcastCallStarted(organizationId, callData) {
        if (!global.broadcastToOrganization) {
            logger.warn('⚠️  [WEBSOCKET] broadcastToOrganization not available');
            return;
        }

        try {
            const broadcastData = {
                type: 'call_started',
                callId: callData.callId || callData.id,
                contactId: callData.contactId,
                campaignId: callData.campaignId,
                phoneNumber: callData.phoneNumber || callData.toPhone || callData.phone,
                fromNumber: callData.fromNumber,
                contactName: callData.contactName || callData.contact_name || `${callData.firstName || ''} ${callData.lastName || ''}`.trim(),
                automated: callData.automated !== false,
                timestamp: new Date().toISOString()
            };

            global.broadcastToOrganization(organizationId, broadcastData);
            logger.info(`📡 [WEBSOCKET] Broadcasted call_started for call ${broadcastData.callId}`);
        } catch (error) {
            logger.error('❌ [WEBSOCKET] Error broadcasting call started:', error);
        }
    }

    /**
     * Broadcast call status update
     */
    static broadcastCallStatusUpdate(organizationId, callId, status, metadata = {}) {
        if (!global.broadcastToOrganization) {
            logger.warn('⚠️  [WEBSOCKET] broadcastToOrganization not available');
            return;
        }

        try {
            const broadcastData = {
                type: 'call_status_update',
                callId: callId,
                status: status,
                duration: metadata.duration,
                emotion: metadata.emotion,
                cost: metadata.cost,
                message: metadata.message,
                phase: metadata.phase, // 'listening', 'processing', etc.
                callControlId: metadata.callControlId,
                timestamp: new Date().toISOString(),
                ...metadata
            };

            global.broadcastToOrganization(organizationId, broadcastData);
            logger.info(`📡 [WEBSOCKET] Broadcasted call_status_update for call ${callId} - status: ${status}`);
        } catch (error) {
            logger.error('❌ [WEBSOCKET] Error broadcasting call status update:', error);
        }
    }

    /**
     * Broadcast conversation turn (customer/AI exchange)
     */
    static broadcastConversationTurn(organizationId, callId, conversationData) {
        if (!global.broadcastToOrganization) {
            logger.warn('⚠️  [WEBSOCKET] broadcastToOrganization not available');
            return;
        }

        try {
            const broadcastData = {
                type: 'conversation_turn',
                callId: callId,
                userInput: conversationData.user_input || conversationData.userInput,
                aiResponse: conversationData.ai_response || conversationData.aiResponse,
                turn: conversationData.turn || conversationData.turnNumber,
                emotion: conversationData.emotion,
                intent: conversationData.intent,
                confidence: conversationData.confidence,
                suggestedActions: conversationData.suggested_actions || conversationData.suggestedActions,
                timestamp: conversationData.timestamp || new Date().toISOString()
            };

            global.broadcastToOrganization(organizationId, broadcastData);
            logger.info(`📡 [WEBSOCKET] Broadcasted conversation_turn for call ${callId} - turn ${broadcastData.turn}`);
        } catch (error) {
            logger.error('❌ [WEBSOCKET] Error broadcasting conversation turn:', error);
        }
    }

    /**
     * Broadcast call ended event
     */
    static broadcastCallEnded(organizationId, callId, callSummary) {
        if (!global.broadcastToOrganization) {
            logger.warn('⚠️  [WEBSOCKET] broadcastToOrganization not available');
            return;
        }

        try {
            const broadcastData = {
                type: 'call_ended',
                callId: callId,
                status: callSummary.status || 'completed',
                outcome: callSummary.outcome,
                duration: callSummary.duration || 0,
                totalTurns: callSummary.totalTurns || callSummary.turns || 0,
                cost: callSummary.cost || 0,
                timestamp: new Date().toISOString()
            };

            global.broadcastToOrganization(organizationId, broadcastData);
            logger.info(`📡 [WEBSOCKET] Broadcasted call_ended for call ${callId} - outcome: ${broadcastData.outcome}`);
        } catch (error) {
            logger.error('❌ [WEBSOCKET] Error broadcasting call ended:', error);
        }
    }

    /**
     * Generic broadcast to organization
     */
    static broadcastToOrganization(organizationId, data) {
        if (!global.broadcastToOrganization) {
            logger.warn('WebSocket broadcaster not available');
            return;
        }

        try {
            global.broadcastToOrganization(organizationId, data);
        } catch (error) {
            logger.error('Error broadcasting to organization:', error);
        }
    }

    /**
     * Check if WebSocket broadcasting is available
     */
    static isAvailable() {
        return !!(global.broadcastToOrganization &&
                  global.broadcastToCall);
    }
}

module.exports = WebSocketBroadcaster;
