const { query } = require('../config/database');
const logger = require('../utils/logger');
const { analyzeCallTranscript } = require('./ai-analysis');

/**
 * Warm Transfer Service
 * Handles real-time warm transfers from AI to human agents
 */

/**
 * Request a warm transfer for a call
 * @param {string} callId - The call ID
 * @param {string} fromAgentId - The agent requesting the transfer
 * @param {string} toAgentId - The agent to transfer to
 * @param {string} reason - Reason for transfer
 * @param {Object} intentData - Intent detection data
 * @returns {Promise<Object>} Transfer request details
 */
async function requestWarmTransfer(callId, fromAgentId, toAgentId, reason, intentData = null) {
  try {
    // Get call details
    const callResult = await query(`
      SELECT c.*, co.first_name, co.last_name, co.phone, co.email
      FROM calls c
      JOIN contacts co ON c.contact_id = co.id
      WHERE c.id = $1
    `, [callId]);

    if (callResult.rows.length === 0) {
      throw new Error('Call not found');
    }

    const call = callResult.rows[0];

    // Check if agent is available
    const agentResult = await query(`
      SELECT u.*, ua.is_available, ua.last_seen_at
      FROM users u
      LEFT JOIN user_availability ua ON u.id = ua.user_id
      WHERE u.id = $1 AND u.role IN ('agent', 'manager', 'admin')
    `, [toAgentId]);

    if (agentResult.rows.length === 0) {
      throw new Error('Target agent not found or not authorized for transfers');
    }

    const agent = agentResult.rows[0];
    if (!agent.is_available) {
      throw new Error('Target agent is not available');
    }

    // Create transfer request
    const transferResult = await query(`
      INSERT INTO warm_transfers (
        call_id, from_agent_id, to_agent_id, transfer_reason,
        intent_label, intent_confidence, status
      ) VALUES ($1, $2, $3, $4, $5, $6, 'pending')
      RETURNING *
    `, [
      callId,
      fromAgentId,
      toAgentId,
      reason,
      intentData?.label || null,
      intentData?.confidence || null
    ]);

    const transfer = transferResult.rows[0];

    // Prepare transfer notification data
    const transferData = {
      id: transfer.id,
      callId: call.id,
      contactName: `${call.first_name} ${call.last_name}`,
      contactPhone: call.phone,
      contactEmail: call.email,
      fromAgentId: transfer.from_agent_id,
      toAgentId: transfer.to_agent_id,
      reason: transfer.transfer_reason,
      intentLabel: transfer.intent_label,
      intentConfidence: transfer.intent_confidence,
      status: transfer.status,
      requestedAt: transfer.requested_at
    };

    logger.info(`Warm transfer requested: ${transfer.id}`, {
      callId,
      fromAgentId,
      toAgentId,
      reason
    });

    return transferData;
  } catch (error) {
    logger.error('Error requesting warm transfer:', error);
    throw error;
  }
}

/**
 * Accept a warm transfer request
 * @param {string} transferId - The transfer ID
 * @param {string} agentId - The agent accepting the transfer
 * @returns {Promise<Object>} Updated transfer details
 */
async function acceptWarmTransfer(transferId, agentId) {
  try {
    // Verify the agent is the intended recipient
    const transferResult = await query(`
      SELECT * FROM warm_transfers
      WHERE id = $1 AND to_agent_id = $2 AND status = 'pending'
    `, [transferId, agentId]);

    if (transferResult.rows.length === 0) {
      throw new Error('Transfer request not found or not authorized');
    }

    const transfer = transferResult.rows[0];

    // Update transfer status
    const updateResult = await query(`
      UPDATE warm_transfers
      SET status = 'accepted', responded_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `, [transferId]);

    const updatedTransfer = updateResult.rows[0];

    // Get call and contact details for notification
    const callResult = await query(`
      SELECT c.*, co.first_name, co.last_name, co.phone, co.email
      FROM calls c
      JOIN contacts co ON c.contact_id = co.id
      WHERE c.id = $1
    `, [transfer.call_id]);

    const call = callResult.rows[0];

    const transferData = {
      id: updatedTransfer.id,
      callId: call.id,
      contactName: `${call.first_name} ${call.last_name}`,
      contactPhone: call.phone,
      contactEmail: call.email,
      fromAgentId: updatedTransfer.from_agent_id,
      toAgentId: updatedTransfer.to_agent_id,
      reason: updatedTransfer.transfer_reason,
      intentLabel: updatedTransfer.intent_label,
      intentConfidence: updatedTransfer.intent_confidence,
      status: updatedTransfer.status,
      requestedAt: updatedTransfer.requested_at,
      respondedAt: updatedTransfer.responded_at
    };

    logger.info(`Warm transfer accepted: ${transferId}`, {
      transferId,
      agentId,
      callId: transfer.call_id
    });

    return transferData;
  } catch (error) {
    logger.error('Error accepting warm transfer:', error);
    throw error;
  }
}

/**
 * Reject a warm transfer request
 * @param {string} transferId - The transfer ID
 * @param {string} agentId - The agent rejecting the transfer
 * @param {string} reason - Reason for rejection
 * @returns {Promise<Object>} Updated transfer details
 */
async function rejectWarmTransfer(transferId, agentId, reason = null) {
  try {
    // Verify the agent is the intended recipient
    const transferResult = await query(`
      SELECT * FROM warm_transfers
      WHERE id = $1 AND to_agent_id = $2 AND status = 'pending'
    `, [transferId, agentId]);

    if (transferResult.rows.length === 0) {
      throw new Error('Transfer request not found or not authorized');
    }

    const transfer = transferResult.rows[0];

    // Update transfer status
    const updateResult = await query(`
      UPDATE warm_transfers
      SET status = 'rejected', responded_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `, [transferId]);

    const updatedTransfer = updateResult.rows[0];

    logger.info(`Warm transfer rejected: ${transferId}`, {
      transferId,
      agentId,
      reason,
      callId: transfer.call_id
    });

    return {
      id: updatedTransfer.id,
      status: updatedTransfer.status,
      respondedAt: updatedTransfer.responded_at
    };
  } catch (error) {
    logger.error('Error rejecting warm transfer:', error);
    throw error;
  }
}

/**
 * Complete a warm transfer
 * @param {string} transferId - The transfer ID
 * @param {string} agentId - The agent completing the transfer
 * @returns {Promise<Object>} Updated transfer details
 */
async function completeWarmTransfer(transferId, agentId) {
  try {
    // Verify the agent is authorized to complete the transfer
    const transferResult = await query(`
      SELECT * FROM warm_transfers
      WHERE id = $1 AND (from_agent_id = $2 OR to_agent_id = $2) AND status = 'accepted'
    `, [transferId, agentId]);

    if (transferResult.rows.length === 0) {
      throw new Error('Transfer request not found or not authorized');
    }

    const transfer = transferResult.rows[0];

    // Update transfer status
    const updateResult = await query(`
      UPDATE warm_transfers
      SET status = 'completed', completed_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `, [transferId]);

    const updatedTransfer = updateResult.rows[0];

    logger.info(`Warm transfer completed: ${transferId}`, {
      transferId,
      agentId,
      callId: transfer.call_id
    });

    return {
      id: updatedTransfer.id,
      status: updatedTransfer.status,
      completedAt: updatedTransfer.completed_at
    };
  } catch (error) {
    logger.error('Error completing warm transfer:', error);
    throw error;
  }
}

/**
 * Get pending transfer requests for an agent
 * @param {string} agentId - The agent ID
 * @returns {Promise<Array>} List of pending transfers
 */
async function getPendingTransfers(agentId) {
  try {
    const result = await query(`
      SELECT
        wt.*,
        c.contact_id,
        co.first_name,
        co.last_name,
        co.phone,
        co.email,
        fa.first_name as from_agent_first_name,
        fa.last_name as from_agent_last_name
      FROM warm_transfers wt
      JOIN calls c ON wt.call_id = c.id
      JOIN contacts co ON c.contact_id = co.id
      JOIN users fa ON wt.from_agent_id = fa.id
      WHERE wt.to_agent_id = $1 AND wt.status = 'pending'
      ORDER BY wt.requested_at DESC
    `, [agentId]);

    return result.rows.map(row => ({
      id: row.id,
      callId: row.call_id,
      contactId: row.contact_id,
      contactName: `${row.first_name} ${row.last_name}`,
      contactPhone: row.phone,
      contactEmail: row.email,
      fromAgentName: `${row.from_agent_first_name} ${row.from_agent_last_name}`,
      reason: row.transfer_reason,
      intentLabel: row.intent_label,
      intentConfidence: row.intent_confidence,
      status: row.status,
      requestedAt: row.requested_at
    }));
  } catch (error) {
    logger.error('Error getting pending transfers:', error);
    throw error;
  }
}

/**
 * Get transfer history for an agent
 * @param {string} agentId - The agent ID
 * @param {number} limit - Number of records to return
 * @param {number} offset - Offset for pagination
 * @returns {Promise<Object>} Transfer history with pagination
 */
async function getTransferHistory(agentId, limit = 20, offset = 0) {
  try {
    const result = await query(`
      SELECT
        wt.*,
        c.contact_id,
        co.first_name,
        co.last_name,
        co.phone,
        fa.first_name as from_agent_first_name,
        fa.last_name as from_agent_last_name,
        ta.first_name as to_agent_first_name,
        ta.last_name as to_agent_last_name
      FROM warm_transfers wt
      JOIN calls c ON wt.call_id = c.id
      JOIN contacts co ON c.contact_id = co.id
      JOIN users fa ON wt.from_agent_id = fa.id
      JOIN users ta ON wt.to_agent_id = ta.id
      WHERE (wt.from_agent_id = $1 OR wt.to_agent_id = $1)
      ORDER BY wt.requested_at DESC
      LIMIT $2 OFFSET $3
    `, [agentId, limit, offset]);

    const countResult = await query(`
      SELECT COUNT(*) as total
      FROM warm_transfers wt
      WHERE (wt.from_agent_id = $1 OR wt.to_agent_id = $1)
    `, [agentId]);

    const total = parseInt(countResult.rows[0].total);

    return {
      transfers: result.rows.map(row => ({
        id: row.id,
        callId: row.call_id,
        contactId: row.contact_id,
        contactName: `${row.first_name} ${row.last_name}`,
        contactPhone: row.phone,
        fromAgentName: `${row.from_agent_first_name} ${row.from_agent_last_name}`,
        toAgentName: `${row.to_agent_first_name} ${row.to_agent_last_name}`,
        reason: row.transfer_reason,
        intentLabel: row.intent_label,
        intentConfidence: row.intent_confidence,
        status: row.status,
        requestedAt: row.requested_at,
        respondedAt: row.responded_at,
        completedAt: row.completed_at
      })),
      total,
      limit,
      offset
    };
  } catch (error) {
    logger.error('Error getting transfer history:', error);
    throw error;
  }
}

/**
 * Detect high-intent and trigger warm transfer
 * @param {string} callId - The call ID
 * @param {string} transcript - Call transcript
 * @param {Object} analysis - AI analysis results
 * @returns {Promise<Object|null>} Transfer request if triggered
 */
async function detectHighIntentAndTransfer(callId, transcript, analysis) {
  try {
    // Check if intent confidence is high enough for transfer
    const highIntentThreshold = 0.8;
    const highIntentLabels = ['demo_request', 'pricing_inquiry', 'urgent_need', 'decision_maker'];

    if (analysis.intent &&
        analysis.intent.confidence >= highIntentThreshold &&
        highIntentLabels.includes(analysis.intent.label)) {

      // Get available agents
      const agentsResult = await query(`
        SELECT u.id, u.first_name, u.last_name, ua.is_available
        FROM users u
        LEFT JOIN user_availability ua ON u.id = ua.user_id
        WHERE u.organization_id = (
          SELECT organization_id FROM calls WHERE id = $1
        ) AND u.role IN ('agent', 'manager', 'admin')
        AND ua.is_available = true
        ORDER BY ua.last_seen_at DESC
        LIMIT 1
      `, [callId]);

      if (agentsResult.rows.length > 0) {
        const agent = agentsResult.rows[0];

        // Request warm transfer
        const transferData = await requestWarmTransfer(
          callId,
          null, // AI agent
          agent.id,
          `High intent detected: ${analysis.intent.label}`,
          analysis.intent
        );

        logger.info(`High intent detected, warm transfer requested`, {
          callId,
          intentLabel: analysis.intent.label,
          intentConfidence: analysis.intent.confidence,
          toAgentId: agent.id
        });

        return transferData;
      }
    }

    return null;
  } catch (error) {
    logger.error('Error detecting high intent and transferring:', error);
    throw error;
  }
}

module.exports = {
  requestWarmTransfer,
  acceptWarmTransfer,
  rejectWarmTransfer,
  completeWarmTransfer,
  getPendingTransfers,
  getTransferHistory,
  detectHighIntentAndTransfer
};
