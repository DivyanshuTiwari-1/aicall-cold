const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const Joi = require('joi');
const warmTransferService = require('../services/warm-transfer');
const logger = require('../utils/logger');

// Validation schemas
const requestTransferSchema = Joi.object({
  callId: Joi.string().uuid().required(),
  toAgentId: Joi.string().uuid().required(),
  reason: Joi.string().max(255).required(),
  intentData: Joi.object({
    label: Joi.string().max(100),
    confidence: Joi.number().min(0).max(1)
  }).optional()
});

const acceptTransferSchema = Joi.object({
  transferId: Joi.string().uuid().required()
});

const rejectTransferSchema = Joi.object({
  transferId: Joi.string().uuid().required(),
  reason: Joi.string().max(255).optional()
});

const completeTransferSchema = Joi.object({
  transferId: Joi.string().uuid().required()
});

/**
 * @route POST /api/v1/warm-transfers/request
 * @desc Request a warm transfer
 * @access Private (Agent, Manager, Admin)
 */
router.post('/request',
  authenticateToken,
  requireRole('agent', 'manager', 'admin'),
  validateRequest(requestTransferSchema),
  async (req, res) => {
    try {
      const { callId, toAgentId, reason, intentData } = req.body;
      const fromAgentId = req.user.id;

      const transferData = await warmTransferService.requestWarmTransfer(
        callId,
        fromAgentId,
        toAgentId,
        reason,
        intentData
      );

      // Emit WebSocket event for real-time notification
      req.app.get('io').to(`agent_${toAgentId}`).emit('warm_transfer_request', transferData);

      res.status(201).json({
        success: true,
        data: transferData,
        message: 'Warm transfer request sent successfully'
      });
    } catch (error) {
      logger.error('Error requesting warm transfer:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to request warm transfer'
      });
    }
  }
);

/**
 * @route POST /api/v1/warm-transfers/accept
 * @desc Accept a warm transfer request
 * @access Private (Agent, Manager, Admin)
 */
router.post('/accept',
  authenticateToken,
  requireRole('agent', 'manager', 'admin'),
  validateRequest(acceptTransferSchema),
  async (req, res) => {
    try {
      const { transferId } = req.body;
      const agentId = req.user.id;

      const transferData = await warmTransferService.acceptWarmTransfer(transferId, agentId);

      // Emit WebSocket event for real-time notification
      req.app.get('io').to(`agent_${transferData.fromAgentId}`).emit('warm_transfer_accepted', transferData);

      res.json({
        success: true,
        data: transferData,
        message: 'Warm transfer accepted successfully'
      });
    } catch (error) {
      logger.error('Error accepting warm transfer:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to accept warm transfer'
      });
    }
  }
);

/**
 * @route POST /api/v1/warm-transfers/reject
 * @desc Reject a warm transfer request
 * @access Private (Agent, Manager, Admin)
 */
router.post('/reject',
  authenticateToken,
  requireRole('agent', 'manager', 'admin'),
  validateRequest(rejectTransferSchema),
  async (req, res) => {
    try {
      const { transferId, reason } = req.body;
      const agentId = req.user.id;

      const transferData = await warmTransferService.rejectWarmTransfer(transferId, agentId, reason);

      // Emit WebSocket event for real-time notification
      req.app.get('io').to(`agent_${transferData.fromAgentId}`).emit('warm_transfer_rejected', transferData);

      res.json({
        success: true,
        data: transferData,
        message: 'Warm transfer rejected'
      });
    } catch (error) {
      logger.error('Error rejecting warm transfer:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to reject warm transfer'
      });
    }
  }
);

/**
 * @route POST /api/v1/warm-transfers/complete
 * @desc Complete a warm transfer
 * @access Private (Agent, Manager, Admin)
 */
router.post('/complete',
  authenticateToken,
  requireRole('agent', 'manager', 'admin'),
  validateRequest(completeTransferSchema),
  async (req, res) => {
    try {
      const { transferId } = req.body;
      const agentId = req.user.id;

      const transferData = await warmTransferService.completeWarmTransfer(transferId, agentId);

      // Emit WebSocket event for real-time notification
      req.app.get('io').to(`agent_${transferData.fromAgentId}`).emit('warm_transfer_completed', transferData);

      res.json({
        success: true,
        data: transferData,
        message: 'Warm transfer completed successfully'
      });
    } catch (error) {
      logger.error('Error completing warm transfer:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to complete warm transfer'
      });
    }
  }
);

/**
 * @route GET /api/v1/warm-transfers/pending
 * @desc Get pending transfer requests for the current agent
 * @access Private (Agent, Manager, Admin)
 */
router.get('/pending',
  authenticateToken,
  requireRole('agent', 'manager', 'admin'),
  async (req, res) => {
    try {
      const agentId = req.user.id;
      const transfers = await warmTransferService.getPendingTransfers(agentId);

      res.json({
        success: true,
        data: transfers,
        message: 'Pending transfers retrieved successfully'
      });
    } catch (error) {
      logger.error('Error getting pending transfers:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get pending transfers'
      });
    }
  }
);

/**
 * @route GET /api/v1/warm-transfers/history
 * @desc Get transfer history for the current agent
 * @access Private (Agent, Manager, Admin)
 */
router.get('/history',
  authenticateToken,
  requireRole('agent', 'manager', 'admin'),
  async (req, res) => {
    try {
      const agentId = req.user.id;
      const limit = parseInt(req.query.limit) || 20;
      const offset = parseInt(req.query.offset) || 0;

      const result = await warmTransferService.getTransferHistory(agentId, limit, offset);

      res.json({
        success: true,
        data: result,
        message: 'Transfer history retrieved successfully'
      });
    } catch (error) {
      logger.error('Error getting transfer history:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get transfer history'
      });
    }
  }
);

/**
 * @route GET /api/v1/warm-transfers/:id
 * @desc Get specific transfer details
 * @access Private (Agent, Manager, Admin)
 */
router.get('/:id',
  authenticateToken,
  requireRole('agent', 'manager', 'admin'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const agentId = req.user.id;

      // Get transfer details with authorization check
      const result = await warmTransferService.getTransferHistory(agentId, 1, 0);
      const transfer = result.transfers.find(t => t.id === id);

      if (!transfer) {
        return res.status(404).json({
          success: false,
          message: 'Transfer not found or not authorized'
        });
      }

      res.json({
        success: true,
        data: transfer,
        message: 'Transfer details retrieved successfully'
      });
    } catch (error) {
      logger.error('Error getting transfer details:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get transfer details'
      });
    }
  }
);

module.exports = router;
