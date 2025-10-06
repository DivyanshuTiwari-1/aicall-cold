const express = require('express');
const Joi = require('joi');
const { query } = require('../config/database');
const logger = require('../utils/logger');

const router = express.Router();

// Validation schemas
const startCallSchema = Joi.object({
    campaign_id: Joi.string().uuid().required(),
    contact_id: Joi.string().uuid().required()
});

const completeCallSchema = Joi.object({
    status: Joi.string().valid('completed', 'failed', 'busy', 'no_answer').required(),
    outcome: Joi.string().valid('scheduled', 'interested', 'not_interested', 'callback', 'voicemail', 'busy', 'no_answer', 'failed').optional(),
    duration: Joi.number().integer().min(0).optional(),
    transcript: Joi.string().optional(),
    emotion: Joi.string().optional(),
    intent_score: Joi.number().min(0).max(1).optional(),
    csat_score: Joi.number().min(1).max(5).optional(),
    ai_insights: Joi.object().optional()
});

// Start a call
router.post('/start', async(req, res) => {
    try {
        const { error, value } = startCallSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: error.details.map(d => d.message)
            });
        }

        const { campaign_id, contact_id } = value;

        // Verify campaign and contact belong to organization
        const verification = await query(`
      SELECT c.id as campaign_id, ct.id as contact_id, ct.phone, ct.first_name, ct.last_name
      FROM campaigns c
      JOIN contacts ct ON c.id = ct.campaign_id
      WHERE c.id = $1 AND ct.id = $2 AND c.organization_id = $3
    `, [campaign_id, contact_id, req.organizationId]);

        if (verification.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Campaign or contact not found'
            });
        }

        const { phone, first_name, last_name } = verification.rows[0];

        // Check if contact is on DNC list
        const dncCheck = await query(
            'SELECT id FROM dnc_registry WHERE organization_id = $1 AND phone = $2', [req.organizationId, phone]
        );

        if (dncCheck.rows.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Contact is on Do Not Call list'
            });
        }

        // Check for existing active call
        const activeCall = await query(
            'SELECT id FROM calls WHERE contact_id = $1 AND status IN ($2, $3)', [contact_id, 'initiated', 'in_progress']
        );

        if (activeCall.rows.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Contact already has an active call'
            });
        }

        // Create call record
        const result = await query(`
      INSERT INTO calls (organization_id, campaign_id, contact_id, status)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [req.organizationId, campaign_id, contact_id, 'initiated']);

        const call = result.rows[0];

        // Log call event
        await query(`
      INSERT INTO call_events (call_id, event_type, event_data)
      VALUES ($1, $2, $3)
    `, [call.id, 'call_initiated', JSON.stringify({
            contact_name: `${first_name} ${last_name}`,
            phone: phone,
            initiated_by: req.user.id
        })]);

        logger.info(`Call started: ${call.id} for contact ${contact_id}`);

        // Dispatch to provider based on VOICE_STACK
        try {
            const { startOutboundCall } = require('../services/telephony');
            await startOutboundCall({
                callId: call.id,
                organizationId: req.organizationId,
                campaignId: campaign_id,
                contactId: contact_id,
                toPhone: phone
            });
        } catch (providerError) {
            logger.error('Telephony provider start error:', providerError);
            return res.status(500).json({ success: false, message: 'Failed to initiate telephony call' });
        }

        res.status(201).json({
            success: true,
            message: 'Call initiated successfully',
            call: {
                id: call.id,
                campaignId: call.campaign_id,
                contactId: call.contact_id,
                status: call.status,
                createdAt: call.created_at
            }
        });

    } catch (error) {
        logger.error('Call start error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to start call'
        });
    }
});

// Complete a call
router.post('/complete', async(req, res) => {
    try {
        const { error, value } = completeCallSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: error.details.map(d => d.message)
            });
        }

        const { call_id, ...callData } = req.body;

        // Verify call exists and belongs to organization
        const callCheck = await query(
            'SELECT id, status FROM calls WHERE id = $1 AND organization_id = $2', [call_id, req.organizationId]
        );

        if (callCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Call not found'
            });
        }

        const existingCall = callCheck.rows[0];

        if (existingCall.status === 'completed') {
            return res.status(400).json({
                success: false,
                message: 'Call already completed'
            });
        }

        // Update call with completion data
        const updates = [];
        const params = [];
        let paramCount = 0;

        Object.keys(callData).forEach(key => {
            if (callData[key] !== undefined) {
                paramCount++;
                updates.push(`${key} = $${paramCount}`);
                params.push(key === 'ai_insights' ? JSON.stringify(callData[key]) : callData[key]);
            }
        });

        updates.push(`updated_at = CURRENT_TIMESTAMP`);
        params.push(call_id, req.organizationId);

        const result = await query(`
      UPDATE calls 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount + 1} AND organization_id = $${paramCount + 2}
      RETURNING *
    `, params);

        const call = result.rows[0];

        // Log call completion event
        await query(`
      INSERT INTO call_events (call_id, event_type, event_data)
      VALUES ($1, $2, $3)
    `, [call.id, 'call_completed', JSON.stringify({
            status: call.status,
            outcome: call.outcome,
            duration: call.duration,
            completed_by: req.user.id
        })]);

        // Update contact status if call was successful
        if (call.outcome === 'scheduled' || call.outcome === 'interested') {
            await query(
                'UPDATE contacts SET status = $1, last_contacted = CURRENT_TIMESTAMP WHERE id = $2', ['contacted', call.contact_id]
            );
        }

        logger.info(`Call completed: ${call.id} with outcome ${call.outcome}`);

        res.json({
            success: true,
            message: 'Call completed successfully',
            call: {
                id: call.id,
                campaignId: call.campaign_id,
                contactId: call.contact_id,
                status: call.status,
                outcome: call.outcome,
                duration: call.duration,
                transcript: call.transcript,
                emotion: call.emotion,
                intentScore: call.intent_score,
                csatScore: call.csat_score,
                aiInsights: call.ai_insights,
                updatedAt: call.updated_at
            }
        });

    } catch (error) {
        logger.error('Call completion error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to complete call'
        });
    }
});

// Get call history
router.get('/', async(req, res) => {
    try {
        const {
            campaign_id,
            contact_id,
            status,
            outcome,
            limit = 50,
            offset = 0
        } = req.query;

        let whereClause = 'WHERE c.organization_id = $1';
        const params = [req.organizationId];
        let paramCount = 1;

        if (campaign_id) {
            paramCount++;
            whereClause += ` AND c.campaign_id = $${paramCount}`;
            params.push(campaign_id);
        }

        if (contact_id) {
            paramCount++;
            whereClause += ` AND c.contact_id = $${paramCount}`;
            params.push(contact_id);
        }

        if (status) {
            paramCount++;
            whereClause += ` AND c.status = $${paramCount}`;
            params.push(status);
        }

        if (outcome) {
            paramCount++;
            whereClause += ` AND c.outcome = $${paramCount}`;
            params.push(outcome);
        }

        const result = await query(`
      SELECT 
        c.*,
        ct.first_name,
        ct.last_name,
        ct.phone,
        ct.company,
        cp.name as campaign_name
      FROM calls c
      JOIN contacts ct ON c.contact_id = ct.id
      JOIN campaigns cp ON c.campaign_id = cp.id
      ${whereClause}
      ORDER BY c.created_at DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `, [...params, parseInt(limit), parseInt(offset)]);

        const calls = result.rows.map(call => ({
            id: call.id,
            campaignId: call.campaign_id,
            contactId: call.contact_id,
            campaignName: call.campaign_name,
            contactName: `${call.first_name} ${call.last_name}`,
            phone: call.phone,
            company: call.company,
            status: call.status,
            outcome: call.outcome,
            duration: call.duration,
            transcript: call.transcript,
            emotion: call.emotion,
            intentScore: call.intent_score,
            csatScore: call.csat_score,
            aiInsights: call.ai_insights,
            cost: call.cost,
            createdAt: call.created_at,
            updatedAt: call.updated_at
        }));

        res.json({
            success: true,
            calls,
            pagination: {
                limit: parseInt(limit),
                offset: parseInt(offset),
                total: calls.length
            }
        });

    } catch (error) {
        logger.error('Calls fetch error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch calls'
        });
    }
});

// Get single call
router.get('/:id', async(req, res) => {
    try {
        const { id } = req.params;

        const result = await query(`
      SELECT 
        c.*,
        ct.first_name,
        ct.last_name,
        ct.phone,
        ct.email,
        ct.company,
        ct.title,
        cp.name as campaign_name
      FROM calls c
      JOIN contacts ct ON c.contact_id = ct.id
      JOIN campaigns cp ON c.campaign_id = cp.id
      WHERE c.id = $1 AND c.organization_id = $2
    `, [id, req.organizationId]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Call not found'
            });
        }

        const call = result.rows[0];

        res.json({
            success: true,
            call: {
                id: call.id,
                campaignId: call.campaign_id,
                contactId: call.contact_id,
                campaignName: call.campaign_name,
                contactName: `${call.first_name} ${call.last_name}`,
                phone: call.phone,
                email: call.email,
                company: call.company,
                title: call.title,
                status: call.status,
                outcome: call.outcome,
                duration: call.duration,
                transcript: call.transcript,
                emotion: call.emotion,
                intentScore: call.intent_score,
                csatScore: call.csat_score,
                aiInsights: call.ai_insights,
                cost: call.cost,
                createdAt: call.created_at,
                updatedAt: call.updated_at
            }
        });

    } catch (error) {
        logger.error('Call fetch error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch call'
        });
    }
});

module.exports = router;