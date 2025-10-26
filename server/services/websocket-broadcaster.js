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
        if (!global.broadcastToOrganization) return;

        try {
            global.broadcastToOrganization(organizationId, {
                type: 'call_started',
                callId: callData.callId || callData.id,
                contactId: callData.contactId,
                campaignId: callData.campaignId,
                phoneNumber: callData.phoneNumber || callData.toPhone,
                automated: callData.automated !== false,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            logger.error('Error broadcasting call started:', error);
        }
    }

    /**
     * Broadcast call status update
     */
    static broadcastCallStatusUpdate(organizationId, callId, status, metadata = {}) {
        if (!global.broadcastToOrganization) return;

        try {
            global.broadcastToOrganization(organizationId, {
                type: 'call_status_update',
                callId: callId,
                status: status,
                duration: metadata.duration,
                emotion: metadata.emotion,
                cost: metadata.cost,
                timestamp: new Date().toISOString(),
                ...metadata
            });
        } catch (error) {
            logger.error('Error broadcasting call status update:', error);
        }
    }

    /**
     * Broadcast conversation turn (customer/AI exchange)
     */
    static broadcastConversationTurn(organizationId, callId, conversationData) {
        if (!global.broadcastToOrganization) return;

        try {
            global.broadcastToOrganization(organizationId, {
                type: 'conversation_turn',
                callId: callId,
                userInput: conversationData.user_input,
                aiResponse: conversationData.ai_response,
                turn: conversationData.turn,
                emotion: conversationData.emotion,
                intent: conversationData.intent,
                confidence: conversationData.confidence,
                suggestedActions: conversationData.suggested_actions,
                timestamp: conversationData.timestamp || new Date().toISOString()
            });
        } catch (error) {
            logger.error('Error broadcasting conversation turn:', error);
        }
    }

    /**
     * Broadcast call ended event
     */
    static broadcastCallEnded(organizationId, callId, callSummary) {
        if (!global.broadcastToOrganization) return;

        try {
            global.broadcastToOrganization(organizationId, {
                type: 'call_ended',
                callId: callId,
                status: callSummary.status || 'completed',
                outcome: callSummary.outcome,
                duration: callSummary.duration,
                totalTurns: callSummary.totalTurns || callSummary.turns,
                cost: callSummary.cost,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            logger.error('Error broadcasting call ended:', error);
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
