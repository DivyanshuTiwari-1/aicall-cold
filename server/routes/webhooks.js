const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const Joi = require('joi');
const { query } = require('../config/database');
const logger = require('../utils/logger');

// Validation schemas
const webhookConfigSchema = Joi.object({
  eventType: Joi.string().valid(
    'call.intent.high',
    'call.emotion.alert',
    'call.objection.detected',
    'call.completed',
    'transcript.ready'
  ).required(),
  webhookUrl: Joi.string().uri().required(),
  secretKey: Joi.string().max(255).optional(),
  isActive: Joi.boolean().default(true),
  retryCount: Joi.number().integer().min(1).max(10).default(3)
});

const testWebhookSchema = Joi.object({
  webhookUrl: Joi.string().uri().required(),
  secretKey: Joi.string().max(255).optional()
});

/**
 * @route GET /api/v1/webhooks
 * @desc Get webhook configurations for organization
 * @access Private (Admin, Manager)
 */
router.get('/',
  authenticateToken,
  requireRole('admin', 'manager'),
  async (req, res) => {
    try {
      const result = await query(`
        SELECT id, event_type, webhook_url, is_active, retry_count, created_at
        FROM webhook_configs
        WHERE organization_id = $1
        ORDER BY created_at DESC
      `, [req.user.organizationId]);

      res.json({
        success: true,
        data: result.rows,
        message: 'Webhook configurations retrieved successfully'
      });
    } catch (error) {
      logger.error('Error getting webhook configurations:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get webhook configurations'
      });
    }
  }
);

/**
 * @route POST /api/v1/webhooks
 * @desc Create webhook configuration
 * @access Private (Admin, Manager)
 */
router.post('/',
  authenticateToken,
  requireRole('admin', 'manager'),
  validateRequest(webhookConfigSchema),
  async (req, res) => {
    try {
      const { eventType, webhookUrl, secretKey, isActive, retryCount } = req.body;

      const result = await query(`
        INSERT INTO webhook_configs (
          organization_id, event_type, webhook_url, secret_key, is_active, retry_count
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [req.user.organizationId, eventType, webhookUrl, secretKey, isActive, retryCount]);

      res.status(201).json({
        success: true,
        data: result.rows[0],
        message: 'Webhook configuration created successfully'
      });
    } catch (error) {
      logger.error('Error creating webhook configuration:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create webhook configuration'
      });
    }
  }
);

/**
 * @route PUT /api/v1/webhooks/:id
 * @desc Update webhook configuration
 * @access Private (Admin, Manager)
 */
router.put('/:id',
  authenticateToken,
  requireRole('admin', 'manager'),
  validateRequest(webhookConfigSchema),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { eventType, webhookUrl, secretKey, isActive, retryCount } = req.body;

      const result = await query(`
        UPDATE webhook_configs
        SET event_type = $2, webhook_url = $3, secret_key = $4, is_active = $5, retry_count = $6
        WHERE id = $1 AND organization_id = $7
        RETURNING *
      `, [id, eventType, webhookUrl, secretKey, isActive, retryCount, req.user.organizationId]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Webhook configuration not found'
        });
      }

      res.json({
        success: true,
        data: result.rows[0],
        message: 'Webhook configuration updated successfully'
      });
    } catch (error) {
      logger.error('Error updating webhook configuration:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update webhook configuration'
      });
    }
  }
);

/**
 * @route DELETE /api/v1/webhooks/:id
 * @desc Delete webhook configuration
 * @access Private (Admin, Manager)
 */
router.delete('/:id',
  authenticateToken,
  requireRole('admin', 'manager'),
  async (req, res) => {
    try {
      const { id } = req.params;

      const result = await query(`
        DELETE FROM webhook_configs
        WHERE id = $1 AND organization_id = $2
        RETURNING *
      `, [id, req.user.organizationId]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Webhook configuration not found'
        });
      }

      res.json({
        success: true,
        message: 'Webhook configuration deleted successfully'
      });
    } catch (error) {
      logger.error('Error deleting webhook configuration:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete webhook configuration'
      });
    }
  }
);

/**
 * @route POST /api/v1/webhooks/test
 * @desc Test webhook delivery
 * @access Private (Admin, Manager)
 */
router.post('/test',
  authenticateToken,
  requireRole('admin', 'manager'),
  validateRequest(testWebhookSchema),
  async (req, res) => {
    try {
      const { webhookUrl, secretKey } = req.body;

      const testPayload = {
        event: 'webhook.test',
        timestamp: new Date().toISOString(),
        data: {
          message: 'This is a test webhook from Outiq',
          organizationId: req.user.organizationId,
          testId: Math.random().toString(36).substring(7)
        }
      };

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': secretKey || '',
          'User-Agent': 'Outiq-Webhook/1.0'
        },
        body: JSON.stringify(testPayload)
      });

      const responseText = await response.text();

      // Log the test attempt
      await query(`
        INSERT INTO webhook_logs (
          webhook_config_id, event_type, payload, status_code, response_body, attempt_count, delivered_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        null, // No config ID for test
        'webhook.test',
        JSON.stringify(testPayload),
        response.status,
        responseText,
        1,
        response.ok ? new Date() : null
      ]);

      res.json({
        success: response.ok,
        statusCode: response.status,
        response: responseText,
        message: response.ok ? 'Webhook test successful' : 'Webhook test failed'
      });
    } catch (error) {
      logger.error('Error testing webhook:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to test webhook',
        error: error.message
      });
    }
  }
);

/**
 * @route GET /api/v1/webhooks/:id/logs
 * @desc Get webhook delivery logs
 * @access Private (Admin, Manager)
 */
router.get('/:id/logs',
  authenticateToken,
  requireRole('admin', 'manager'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const limit = parseInt(req.query.limit) || 50;
      const offset = parseInt(req.query.offset) || 0;

      const result = await query(`
        SELECT wl.*, wc.event_type, wc.webhook_url
        FROM webhook_logs wl
        LEFT JOIN webhook_configs wc ON wl.webhook_config_id = wc.id
        WHERE wc.id = $1 AND wc.organization_id = $2
        ORDER BY wl.created_at DESC
        LIMIT $3 OFFSET $4
      `, [id, req.user.organizationId, limit, offset]);

      const countResult = await query(`
        SELECT COUNT(*) as total
        FROM webhook_logs wl
        LEFT JOIN webhook_configs wc ON wl.webhook_config_id = wc.id
        WHERE wc.id = $1 AND wc.organization_id = $2
      `, [id, req.user.organizationId]);

      res.json({
        success: true,
        data: {
          logs: result.rows,
          total: parseInt(countResult.rows[0].total),
          limit,
          offset
        },
        message: 'Webhook logs retrieved successfully'
      });
    } catch (error) {
      logger.error('Error getting webhook logs:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get webhook logs'
      });
    }
  }
);

/**
 * @route GET /api/v1/webhooks/events
 * @desc Get available webhook event types
 * @access Private (Admin, Manager)
 */
router.get('/events',
  authenticateToken,
  requireRole('admin', 'manager'),
  async (req, res) => {
    try {
      const eventTypes = [
        {
          type: 'call.intent.high',
          name: 'High Intent Detected',
          description: 'Triggered when customer shows high intent (confidence > 0.8)',
          samplePayload: {
            callId: 'uuid',
            intentLabel: 'demo_request',
            intentConfidence: 0.92,
            customerPhone: '+1234567890'
          }
        },
        {
          type: 'call.emotion.alert',
          name: 'Emotional Alert',
          description: 'Triggered when sustained negative emotions are detected',
          samplePayload: {
            callId: 'uuid',
            alertType: 'sustained_frustration',
            emotion: 'frustration',
            intensity: 0.85,
            duration: 25
          }
        },
        {
          type: 'call.objection.detected',
          name: 'Objection Detected',
          description: 'Triggered when customer objections are identified',
          samplePayload: {
            callId: 'uuid',
            objectionType: 'pricing',
            severity: 'high',
            timestamp: 120
          }
        },
        {
          type: 'call.completed',
          name: 'Call Completed',
          description: 'Triggered when a call ends',
          samplePayload: {
            callId: 'uuid',
            duration: 180,
            outcome: 'connected',
            cost: 0.45
          }
        },
        {
          type: 'transcript.ready',
          name: 'Transcript Ready',
          description: 'Triggered when call transcript is available',
          samplePayload: {
            callId: 'uuid',
            transcriptLength: 1500,
            processingTime: 2.5
          }
        }
      ];

      res.json({
        success: true,
        data: eventTypes,
        message: 'Available webhook events retrieved successfully'
      });
    } catch (error) {
      logger.error('Error getting webhook events:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get webhook events'
      });
    }
  }
);

/**
 * @route POST /api/v1/webhooks/telnyx
 * @desc Handle Telnyx Call Control webhooks for automated AI calls
 * @access Public (Telnyx sends these)
 */
router.post('/telnyx', async (req, res) => {
    try {
        const event = req.body.data;
        const eventType = event.event_type;

        logger.info(`📞 Telnyx webhook received: ${eventType}`);

        // Parse metadata from client_state
        let metadata = {};
        try {
            if (event.payload && event.payload.client_state) {
                const decoded = Buffer.from(event.payload.client_state, 'base64').toString('utf-8');
                metadata = JSON.parse(decoded);
            }
        } catch (parseError) {
            logger.error('Failed to parse client_state metadata:', parseError);
        }

        const callControlId = event.payload?.call_control_id;

        // Import conversation orchestrator
        const telnyxAIConversation = require('../services/telnyx-ai-conversation');

        // Handle different event types
        switch (eventType) {
            case 'call.initiated':
                logger.info(`Call initiated: ${callControlId}`);
                // Call is dialing, no action needed
                break;

            case 'call.answered':
                logger.info(`Call answered: ${callControlId}`);
                // Customer answered - start AI conversation
                await telnyxAIConversation.handleCallAnswered(callControlId, metadata);
                break;

            case 'call.playback.ended':
                logger.info(`Playback ended: ${callControlId}`);
                // AI finished speaking - start recording customer
                await telnyxAIConversation.handlePlaybackEnded(callControlId, metadata);
                break;

            case 'call.recording.saved':
                logger.info(`Recording saved: ${callControlId}`);
                const recordingUrl = event.payload?.recording_urls?.wav || event.payload?.public_recording_url;

                if (recordingUrl) {
                    // Customer finished speaking - transcribe and respond
                    await telnyxAIConversation.handleRecordingSaved(callControlId, recordingUrl, metadata);
                } else {
                    logger.warn('Recording URL not found in webhook payload');
                }
                break;

            case 'call.hangup':
                logger.info(`Call hangup: ${callControlId}`);
                const duration = event.payload?.hangup_source ?
                    Math.floor(event.payload.end_time - event.payload.start_time) :
                    0;

                // Call ended - save transcript and update database
                await telnyxAIConversation.handleCallEnded(callControlId, metadata, duration);
                break;

            case 'call.machine.detection.ended':
                // Answering machine detection completed
                logger.info(`Machine detection: ${event.payload?.result}`);

                if (event.payload?.result === 'human') {
                    // Human answered, treat as call.answered
                    await telnyxAIConversation.handleCallAnswered(callControlId, metadata);
                } else {
                    // Machine/voicemail detected, hangup
                    const telnyxCallControl = require('../services/telnyx-call-control');
                    await telnyxCallControl.hangupCall(callControlId);
                }
                break;

            case 'call.speak.ended':
                // Similar to playback.ended but for TTS via Telnyx
                logger.info(`Speak ended: ${callControlId}`);
                await telnyxAIConversation.handlePlaybackEnded(callControlId, metadata);
                break;

            default:
                logger.info(`Unhandled Telnyx event type: ${eventType}`);
        }

        // Always respond 200 OK to Telnyx
        res.status(200).json({ received: true });

    } catch (error) {
        logger.error('Error handling Telnyx webhook:', error);
        // Still return 200 to prevent Telnyx from retrying
        res.status(200).json({ received: true, error: error.message });
    }
});

module.exports = router;
