const express = require('express');
const Joi = require('joi');
const { query } = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
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
router.post('/start', authenticateToken, requireRole('agent', 'admin', 'manager'), async(req, res) => {
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

        // Create call record with initial cost calculation
        // Telnyx rates: $0.011/min for calls + ~$0.003 for TTS per 5-min call
        const INITIAL_COST = 0.014; // Estimated initial cost
        const result = await query(`
      INSERT INTO calls (organization_id, campaign_id, contact_id, status, cost)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [req.organizationId, campaign_id, contact_id, 'initiated', INITIAL_COST]);

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
router.post('/complete/:call_id', authenticateToken, requireRole('agent', 'admin', 'manager'), async(req, res) => {
    try {
        const { call_id } = req.params;

        const { error, value } = completeCallSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: error.details.map(d => d.message)
            });
        }

        const callData = value;

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

        // Calculate cost based on duration (if provided)
        const TELNYX_RATE_PER_MINUTE = 0.011;
        const TELNYX_TTS_RATE_PER_CHAR = 0.000003;

        let calculatedCost = 0.014; // Base cost estimate
        if (callData.duration) {
            const durationMinutes = callData.duration / 60;
            const callCost = durationMinutes * TELNYX_RATE_PER_MINUTE;
            const ttsCost = (durationMinutes * 200) * TELNYX_TTS_RATE_PER_CHAR; // ~200 chars/min
            calculatedCost = callCost + ttsCost;
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

        // Add cost calculation
        paramCount++;
        updates.push(`cost = $${paramCount}`);
        params.push(calculatedCost);

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

        // Trigger lead reuse for missed/unpicked calls
        if (call.outcome === 'no_answer' || call.outcome === 'busy' || call.outcome === 'missed') {
            try {
                const { processUnpickedLeads } = require('../services/lead-reuse');
                // Process reuse asynchronously to avoid blocking the response
                setImmediate(async () => {
                    try {
                        await processUnpickedLeads(req.organizationId);
                    } catch (error) {
                        logger.error('Error processing lead reuse after call completion:', error);
                    }
                });
            } catch (error) {
                logger.error('Error triggering lead reuse:', error);
            }
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
router.get('/', authenticateToken, requireRole('admin', 'manager', 'agent'), async(req, res) => {
    try {
        const {
            campaign_id,
            contact_id,
            status,
            outcome,
            callType,
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

        if (callType) {
            paramCount++;
            whereClause += ` AND c.call_type = $${paramCount}`;
            params.push(callType);
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
            callType: call.call_type,
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

// Get campaign stats
router.get('/campaign-stats', authenticateToken, requireRole('admin', 'manager', 'agent'), async(req, res) => {
    try {
        // Get total campaigns
        const campaignsResult = await query(
            'SELECT COUNT(*) as total FROM campaigns WHERE organization_id = $1',
            [req.organizationId]
        );
        const totalCampaigns = parseInt(campaignsResult.rows[0].total);

        // Get active calls
        const activeCallsResult = await query(
            'SELECT COUNT(*) as active FROM calls WHERE organization_id = $1 AND status IN ($2, $3)',
            [req.organizationId, 'initiated', 'in_progress']
        );
        const activeCalls = parseInt(activeCallsResult.rows[0].active);

        // Get total contacts
        const contactsResult = await query(
            'SELECT COUNT(*) as total FROM contacts WHERE organization_id = $1',
            [req.organizationId]
        );
        const totalContacts = parseInt(contactsResult.rows[0].total);

        // Get queued calls (contacts ready to be called)
        const queuedCallsResult = await query(`
            SELECT COUNT(*) as queued
            FROM contacts c
            WHERE c.organization_id = $1
            AND c.status = 'new'
            AND c.id NOT IN (
                SELECT DISTINCT contact_id
                FROM calls
                WHERE organization_id = $1
                AND status IN ('initiated', 'in_progress')
            )
        `, [req.organizationId]);
        const queuedCalls = parseInt(queuedCallsResult.rows[0].queued);

        res.json({
            success: true,
            stats: {
                totalCampaigns,
                activeCalls,
                totalContacts,
                queuedCalls
            }
        });

    } catch (error) {
        logger.error('Campaign stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch campaign stats'
        });
    }
});

// Get single call
router.get('/:id', authenticateToken, requireRole('admin', 'manager', 'agent'), async(req, res) => {
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

// Update call status (for real-time updates)
router.put('/:id/status', authenticateToken, requireRole('agent', 'admin', 'manager'), async(req, res) => {
    try {
        const { id } = req.params;
        const { status, duration, transcript, emotion, intent_score } = req.body;

        // Verify call exists and belongs to organization
        const callCheck = await query(
            'SELECT id, status FROM calls WHERE id = $1 AND organization_id = $2', [id, req.organizationId]
        );

        if (callCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Call not found'
            });
        }

        // Calculate cost based on current duration
        const TELNYX_RATE_PER_MINUTE = 0.011;
        const TELNYX_TTS_RATE_PER_CHAR = 0.000003;

        let calculatedCost = 0.014; // Base cost estimate
        if (duration) {
            const durationMinutes = duration / 60;
            const callCost = durationMinutes * TELNYX_RATE_PER_MINUTE;
            const ttsCost = (durationMinutes * 200) * TELNYX_TTS_RATE_PER_CHAR;
            calculatedCost = callCost + ttsCost;
        }

        // Update call status and real-time data
        const updates = [];
        const params = [];
        let paramCount = 0;

        if (status) {
            paramCount++;
            updates.push(`status = $${paramCount}`);
            params.push(status);
        }

        if (duration !== undefined) {
            paramCount++;
            updates.push(`duration = $${paramCount}`);
            params.push(duration);
        }

        if (transcript) {
            paramCount++;
            updates.push(`transcript = $${paramCount}`);
            params.push(transcript);
        }

        if (emotion) {
            paramCount++;
            updates.push(`emotion = $${paramCount}`);
            params.push(emotion);
        }

        if (intent_score !== undefined) {
            paramCount++;
            updates.push(`intent_score = $${paramCount}`);
            params.push(intent_score);
        }

        // Update cost
        paramCount++;
        updates.push(`cost = $${paramCount}`);
        params.push(calculatedCost);

        updates.push(`updated_at = CURRENT_TIMESTAMP`);
        params.push(id, req.organizationId);

        const result = await query(`
            UPDATE calls
            SET ${updates.join(', ')}
            WHERE id = $${paramCount + 1} AND organization_id = $${paramCount + 2}
            RETURNING *
        `, params);

        const call = result.rows[0];

        // Log status update event
        await query(`
            INSERT INTO call_events (call_id, event_type, event_data)
            VALUES ($1, $2, $3)
        `, [call.id, 'status_update', JSON.stringify({
            status: call.status,
            duration: call.duration,
            emotion: call.emotion,
            intent_score: call.intent_score,
            cost: call.cost,
            timestamp: new Date().toISOString()
        })]);

        res.json({
            success: true,
            message: 'Call status updated successfully',
            call: {
                id: call.id,
                status: call.status,
                duration: call.duration,
                transcript: call.transcript,
                emotion: call.emotion,
                intentScore: call.intent_score,
                cost: call.cost,
                updatedAt: call.updated_at
            }
        });

    } catch (error) {
        logger.error('Call status update error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update call status'
        });
    }
});

// Get call conversation context
router.get('/:id/conversation', authenticateToken, requireRole('admin', 'manager', 'agent'), async(req, res) => {
    try {
        const { id } = req.params;

        // Get call details
        const callResult = await query(`
            SELECT c.*, ct.first_name, ct.last_name, ct.company, cp.name as campaign_name
            FROM calls c
            JOIN contacts ct ON c.contact_id = ct.id
            JOIN campaigns cp ON c.campaign_id = cp.id
            WHERE c.id = $1 AND c.organization_id = $2
        `, [id, req.organizationId]);

        if (callResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Call not found'
            });
        }

        const call = callResult.rows[0];

        // Get conversation history
        const historyResult = await query(`
            SELECT event_data, timestamp
            FROM call_events
            WHERE call_id = $1 AND event_type = 'ai_conversation'
            ORDER BY timestamp ASC
        `, [id]);

        // Get active scripts
        const scriptsResult = await query(`
            SELECT type, content, variables, confidence_threshold
            FROM scripts
            WHERE organization_id = $1 AND is_active = true
            ORDER BY type
        `, [req.organizationId]);

        const scripts = {};
        scriptsResult.rows.forEach(script => {
            scripts[script.type] = {
                content: script.content,
                variables: script.variables,
                confidence_threshold: script.confidence_threshold
            };
        });

        res.json({
            success: true,
            call: {
                id: call.id,
                status: call.status,
                duration: call.duration,
                transcript: call.transcript,
                emotion: call.emotion,
                intentScore: call.intent_score,
                contactName: `${call.first_name} ${call.last_name}`,
                company: call.company,
                campaignName: call.campaign_name
            },
            conversationHistory: historyResult.rows.map(row => ({
                ...row.event_data,
                timestamp: row.timestamp
            })),
            availableScripts: scripts
        });

    } catch (error) {
        logger.error('Call conversation context error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch call conversation context'
        });
    }
});

// Validation schema for automated calls
const automatedCallSchema = Joi.object({
    campaignId: Joi.string().uuid().required(),
    phoneNumberId: Joi.string().uuid().required()
});

// Validation schema for stopping automated calls (only needs campaignId)
const stopAutomatedCallSchema = Joi.object({
    campaignId: Joi.string().uuid().required()
});

// Start automated calls for a campaign
router.post('/automated/start', authenticateToken, requireRole('admin', 'manager', 'agent'), async(req, res) => {
    try {
        const { error, value } = automatedCallSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: error.details.map(d => d.message)
            });
        }

        const { campaignId, phoneNumberId } = value;

        // Verify campaign exists and belongs to organization
        const campaignCheck = await query(
            'SELECT id, name, status FROM campaigns WHERE id = $1 AND organization_id = $2',
            [campaignId, req.organizationId]
        );

        if (campaignCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Campaign not found'
            });
        }

        const campaign = campaignCheck.rows[0];

        if (campaign.status === 'completed') {
            return res.status(400).json({
                success: false,
                message: 'Cannot start automated calls for completed campaigns'
            });
        }

        // Get and validate phone number selection
        const phoneNumberResult = await query(`
            SELECT pn.id, pn.phone_number, pn.provider, pn.assigned_to,
                   apn.daily_limit, apn.calls_made_today, apn.agent_id
            FROM phone_numbers pn
            LEFT JOIN agent_phone_numbers apn ON pn.id = apn.phone_number_id
            WHERE pn.id = $1 AND pn.organization_id = $2 AND pn.status = 'active'
        `, [phoneNumberId, req.organizationId]);

        if (phoneNumberResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Phone number not found or inactive'
            });
        }

        const selectedNumber = phoneNumberResult.rows[0];

        // Role-based access check
        if (req.user.role === 'agent') {
            // Agents can only use numbers assigned to them
            if (selectedNumber.assigned_to !== req.user.id) {
                return res.status(403).json({
                    success: false,
                    message: 'You can only use phone numbers assigned to you'
                });
            }

            // Check daily limit for agents
            if (selectedNumber.calls_made_today >= selectedNumber.daily_limit) {
                return res.status(400).json({
                    success: false,
                    message: `Daily call limit reached (${selectedNumber.daily_limit} calls)`,
                    limitReached: true,
                    dailyLimit: selectedNumber.daily_limit,
                    callsMadeToday: selectedNumber.calls_made_today
                });
            }
        }

        // Check if campaign has contacts ready for calling
        const contactCheck = await query(`
            SELECT COUNT(*) as count
            FROM contacts
            WHERE campaign_id = $1
            AND status IN ('pending', 'retry', 'new')
            AND organization_id = $2
        `, [campaignId, req.organizationId]);

        const contactCount = parseInt(contactCheck.rows[0].count);

        if (contactCount === 0) {
            return res.status(400).json({
                success: false,
                message: 'No contacts ready for calling. Please add contacts with status "pending", "retry", or "new" to this campaign.'
            });
        }

        logger.info(`Found ${contactCount} contacts ready for calling in campaign ${campaignId}`);

        // Update campaign status to active if it's draft
        if (campaign.status === 'draft') {
            await query(
                'UPDATE campaigns SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
                ['active', campaignId]
            );
            logger.info(`Campaign ${campaignId} status updated from draft to active`);
        }

        // Start the automated call queue
        try {
            const { callQueue } = require('../services/queue');
            await callQueue.startQueue(null, campaignId, phoneNumberId, selectedNumber.phone_number);

            logger.info(`Automated calls started for campaign: ${campaignId} using phone number: ${selectedNumber.phone_number}`);

            res.json({
                success: true,
                message: 'Automated calls started successfully',
                campaignId: campaignId,
                phoneNumber: selectedNumber.phone_number
            });
        } catch (queueError) {
            logger.error('Queue start error:', queueError);
            res.status(500).json({
                success: false,
                message: 'Failed to start automated call queue'
            });
        }

    } catch (error) {
        logger.error('Start automated calls error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to start automated calls'
        });
    }
});

// Stop automated calls for a campaign
router.post('/automated/stop', authenticateToken, requireRole('admin', 'manager', 'agent'), async(req, res) => {
    try {
        const { error, value } = stopAutomatedCallSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: error.details.map(d => d.message)
            });
        }

        const { campaignId } = value;

        // Stop the automated call queue
        try {
            const { callQueue } = require('../services/queue');
            await callQueue.stopQueue(campaignId);

            logger.info(`Automated calls stopped for campaign: ${campaignId}`);

            res.json({
                success: true,
                message: 'Automated calls stopped successfully',
                campaignId: campaignId
            });
        } catch (queueError) {
            logger.error('Queue stop error:', queueError);
            res.status(500).json({
                success: false,
                message: 'Failed to stop automated call queue'
            });
        }

    } catch (error) {
        logger.error('Stop automated calls error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to stop automated calls'
        });
    }
});

// Get queue status for a campaign
router.get('/queue/status/:campaignId', authenticateToken, requireRole('admin', 'manager', 'agent'), async(req, res) => {
    try {
        const { campaignId } = req.params;

        // Verify campaign exists and belongs to organization
        const campaignCheck = await query(
            'SELECT id, name FROM campaigns WHERE id = $1 AND organization_id = $2',
            [campaignId, req.organizationId]
        );

        if (campaignCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Campaign not found'
            });
        }

        // Get queue status from the queue service
        try {
            const { callQueue } = require('../services/queue');
            const status = callQueue.getQueueStatus(campaignId);

            res.json({
                success: true,
                campaignId: campaignId,
                status: status
            });
        } catch (queueError) {
            logger.error('Queue status error:', queueError);
            res.status(500).json({
                success: false,
                message: 'Failed to get queue status'
            });
        }

    } catch (error) {
        logger.error('Queue status error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get queue status'
        });
    }
});

module.exports = router;
