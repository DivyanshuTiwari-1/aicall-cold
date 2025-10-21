const express = require('express');
const Joi = require('joi');
const { query } = require('../config/database');
const logger = require('../utils/logger');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { startManualCall } = require('../services/telephony/providers/asterisk');

const router = express.Router();

// Validation schemas
const startCallSchema = Joi.object({
    contactId: Joi.string().uuid().required(),
    campaignId: Joi.string().uuid().optional()
});

const logCallSchema = Joi.object({
    callId: Joi.string().uuid().required(),
    outcome: Joi.string().valid('answered', 'scheduled', 'callback', 'not_interested',
        'voicemail', 'busy', 'no_answer', 'wrong_number', 'dnc_request').required(),
    duration: Joi.number().integer().min(0).required(),
    notes: Joi.string().max(1000).optional(),
    answered: Joi.boolean().default(false),
    rejected: Joi.boolean().default(false)
});

const completeCallSchema = Joi.object({
    callId: Joi.string().uuid().required(),
    outcome: Joi.string().valid('scheduled', 'interested', 'not_interested', 'callback',
        'voicemail', 'busy', 'no_answer', 'wrong_number', 'dnc_request').required(),
    duration: Joi.number().integer().min(0).required(),
    notes: Joi.string().max(1000).optional(),
    answered: Joi.boolean().default(false),
    rejected: Joi.boolean().default(false)
});

// Start manual call
router.post('/start', authenticateToken, requireRole('agent'), async(req, res) => {
    try {
        const { error, value } = startCallSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: error.details.map(d => d.message)
            });
        }

        const { contactId, campaignId } = value;

        // Verify contact exists and is assigned to user
        const contactResult = await query(`
            SELECT c.id, c.first_name, c.last_name, c.phone, c.company, c.title,
                   c.campaign_id, camp.name as campaign_name
            FROM contacts c
            LEFT JOIN campaigns camp ON c.campaign_id = camp.id
            WHERE c.id = $1 AND c.organization_id = $2
        `, [contactId, req.organizationId]);

        if (contactResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Contact not found'
            });
        }

        const contact = contactResult.rows[0];

        // Check if contact is assigned to user
        const assignmentCheck = await query(`
            SELECT id FROM lead_assignments
            WHERE contact_id = $1 AND assigned_to = $2
              AND status IN ('pending', 'in_progress')
        `, [contactId, req.user.id]);

        if (assignmentCheck.rows.length === 0) {
            return res.status(403).json({
                success: false,
                message: 'Contact not assigned to you'
            });
        }

        // Check if user has SIP extension
        const userResult = await query(`
            SELECT id, sip_extension, sip_username, is_available
            FROM users
            WHERE id = $1
        `, [req.user.id]);

        if (userResult.rows.length === 0 || !userResult.rows[0].sip_extension) {
            return res.status(400).json({
                success: false,
                message: 'SIP extension not configured for user'
            });
        }

        const user = userResult.rows[0];

        if (!user.is_available) {
            return res.status(400).json({
                success: false,
                message: 'User is not available for calls'
            });
        }

        // Create call record
        const callResult = await query(`
            INSERT INTO calls (organization_id, campaign_id, contact_id, initiated_by,
                             call_type, status, cost)
            VALUES ($1, $2, $3, $4, 'manual', 'initiated', 0.0045)
            RETURNING id, created_at
        `, [req.organizationId, contact.campaign_id || campaignId, contactId, req.user.id]);

        const call = callResult.rows[0];

        // Update assignment status to in_progress
        await query(`
            UPDATE lead_assignments
            SET status = 'in_progress', updated_at = CURRENT_TIMESTAMP
            WHERE contact_id = $1 AND assigned_to = $2
        `, [contactId, req.user.id]);

        // Log call event
        await query(`
            INSERT INTO call_events (call_id, event_type, event_data)
            VALUES ($1, 'manual_call_initiated', $2)
        `, [call.id, JSON.stringify({
            contact_name: `${contact.first_name} ${contact.last_name}`,
            phone: contact.phone,
            initiated_by: req.user.email,
            sip_extension: user.sip_extension
        })]);

        // Start the actual call via Asterisk
        try {
            await startManualCall({
                callId: call.id,
                agentExtension: user.sip_extension,
                agentUserId: user.id,
                toPhone: contact.phone,
                contactId: contactId
            });

            logger.info(`Manual call initiated: ${call.id} for contact ${contactId}`);

            res.status(201).json({
                success: true,
                message: 'Manual call initiated successfully',
                call: {
                    id: call.id,
                    contactId: contactId,
                    contactName: `${contact.first_name} ${contact.last_name}`,
                    phone: contact.phone,
                    company: contact.company,
                    title: contact.title,
                    campaignName: contact.campaign_name,
                    status: 'initiated',
                    createdAt: call.created_at
                }
            });

        } catch (telephonyError) {
            logger.error('Telephony provider error:', telephonyError);

            // Update call status to failed
            await query(`
                UPDATE calls
                SET status = 'failed', updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
            `, [call.id]);

            // Reset assignment status
            await query(`
                UPDATE lead_assignments
                SET status = 'pending', updated_at = CURRENT_TIMESTAMP
                WHERE contact_id = $1 AND assigned_to = $2
            `, [contactId, req.user.id]);

            res.status(500).json({
                success: false,
                message: 'Failed to initiate telephony call'
            });
        }

    } catch (error) {
        logger.error('Start manual call error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to start manual call'
        });
    }
});

// Log call outcome (for quick logging)
router.post('/log', authenticateToken, requireRole('agent'), async(req, res) => {
    try {
        const { error, value } = logCallSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: error.details.map(d => d.message)
            });
        }

        const { callId, outcome, duration, notes, answered, rejected } = value;

        // Verify call exists and belongs to user
        const callResult = await query(`
            SELECT c.id, c.contact_id, c.status, co.first_name, co.last_name, co.phone
            FROM calls c
            JOIN contacts co ON c.contact_id = co.id
            WHERE c.id = $1 AND c.initiated_by = $2 AND c.organization_id = $3
        `, [callId, req.user.id, req.organizationId]);

        if (callResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Call not found'
            });
        }

        const call = callResult.rows[0];

        // Update call record
        await query(`
            UPDATE calls
            SET status = 'completed', outcome = $1, duration = $2, notes = $3,
                answered = $4, rejected = $5, updated_at = CURRENT_TIMESTAMP
            WHERE id = $6
        `, [outcome, duration, notes, answered, rejected, callId]);

        // Update contact status based on outcome
        let contactStatus = 'contacted';
        if (outcome === 'not_interested' || outcome === 'dnc_request') {
            contactStatus = 'not_interested';
        } else if (outcome === 'scheduled' || outcome === 'interested') {
            contactStatus = 'interested';
        } else if (outcome === 'callback') {
            contactStatus = 'contacted';
        }

        await query(`
            UPDATE contacts
            SET status = $1, last_contacted = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
        `, [contactStatus, call.contact_id]);

        // Handle DNC request
        if (outcome === 'dnc_request') {
            await query(`
                INSERT INTO dnc_registry (organization_id, phone, reason, source)
                VALUES ($1, $2, 'Manual DNC request', 'agent')
                ON CONFLICT (organization_id, phone) DO NOTHING
            `, [req.organizationId, call.phone]);
        }

        // Update assignment status
        await query(`
            UPDATE lead_assignments
            SET status = 'completed', updated_at = CURRENT_TIMESTAMP
            WHERE contact_id = $1 AND assigned_to = $2
        `, [call.contact_id, req.user.id]);

        // Update user's assigned leads count
        await query(`
            UPDATE users
            SET assigned_leads_count = GREATEST(assigned_leads_count - 1, 0)
            WHERE id = $1
        `, [req.user.id]);

        // Log call event
        await query(`
            INSERT INTO call_events (call_id, event_type, event_data)
            VALUES ($1, 'manual_call_logged', $2)
        `, [callId, JSON.stringify({
            outcome: outcome,
            duration: duration,
            answered: answered,
            rejected: rejected,
            logged_by: req.user.email
        })]);

        logger.info(`Manual call logged: ${callId} with outcome ${outcome}`);

        res.json({
            success: true,
            message: 'Call outcome logged successfully',
            call: {
                id: callId,
                outcome: outcome,
                duration: duration,
                answered: answered,
                rejected: rejected
            }
        });

    } catch (error) {
        logger.error('Log call error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to log call outcome'
        });
    }
});

// Complete call with full details
router.put('/:id/complete', authenticateToken, requireRole('agent'), async(req, res) => {
    try {
        const callId = req.params.id;
        const { error, value } = completeCallSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: error.details.map(d => d.message)
            });
        }

        const { outcome, duration, notes, answered, rejected } = value;

        // Verify call exists and belongs to user
        const callResult = await query(`
            SELECT c.id, c.contact_id, c.status, co.first_name, co.last_name, co.phone
            FROM calls c
            JOIN contacts co ON c.contact_id = co.id
            WHERE c.id = $1 AND c.initiated_by = $2 AND c.organization_id = $3
        `, [callId, req.user.id, req.organizationId]);

        if (callResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Call not found'
            });
        }

        const call = callResult.rows[0];

        // Update call record
        await query(`
            UPDATE calls
            SET status = 'completed', outcome = $1, duration = $2, notes = $3,
                answered = $4, rejected = $5, updated_at = CURRENT_TIMESTAMP
            WHERE id = $6
        `, [outcome, duration, notes, answered, rejected, callId]);

        // Update contact status based on outcome
        let contactStatus = 'contacted';
        if (outcome === 'not_interested' || outcome === 'dnc_request') {
            contactStatus = 'not_interested';
        } else if (outcome === 'scheduled' || outcome === 'interested') {
            contactStatus = 'interested';
        } else if (outcome === 'callback') {
            contactStatus = 'contacted';
        }

        await query(`
            UPDATE contacts
            SET status = $1, last_contacted = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
        `, [contactStatus, call.contact_id]);

        // Handle DNC request
        if (outcome === 'dnc_request') {
            await query(`
                INSERT INTO dnc_registry (organization_id, phone, reason, source)
                VALUES ($1, $2, 'Manual DNC request', 'agent')
                ON CONFLICT (organization_id, phone) DO NOTHING
            `, [req.organizationId, call.phone]);
        }

        // Update assignment status
        await query(`
            UPDATE lead_assignments
            SET status = 'completed', updated_at = CURRENT_TIMESTAMP
            WHERE contact_id = $1 AND assigned_to = $2
        `, [call.contact_id, req.user.id]);

        // Update user's assigned leads count
        await query(`
            UPDATE users
            SET assigned_leads_count = GREATEST(assigned_leads_count - 1, 0)
            WHERE id = $1
        `, [req.user.id]);

        // Log call event
        await query(`
            INSERT INTO call_events (call_id, event_type, event_data)
            VALUES ($1, 'manual_call_completed', $2)
        `, [callId, JSON.stringify({
            outcome: outcome,
            duration: duration,
            answered: answered,
            rejected: rejected,
            completed_by: req.user.email
        })]);

        logger.info(`Manual call completed: ${callId} with outcome ${outcome}`);

        res.json({
            success: true,
            message: 'Call completed successfully',
            call: {
                id: callId,
                outcome: outcome,
                duration: duration,
                answered: answered,
                rejected: rejected,
                contactName: `${call.first_name} ${call.last_name}`
            }
        });

    } catch (error) {
        logger.error('Complete call error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to complete call'
        });
    }
});

// Get my call history
router.get('/my-calls', authenticateToken, async(req, res) => {
    try {
        const {
            status = 'all',
                outcome = 'all',
                limit = 50,
                offset = 0,
                period = '7d'
        } = req.query;

        let whereClause = 'c.initiated_by = $1 AND c.organization_id = $2 AND c.call_type = \'manual\'';
        let queryParams = [req.user.id, req.organizationId];
        let paramCount = 2;

        if (status !== 'all') {
            paramCount++;
            whereClause += ` AND c.status = $${paramCount}`;
            queryParams.push(status);
        }

        if (outcome !== 'all') {
            paramCount++;
            whereClause += ` AND c.outcome = $${paramCount}`;
            queryParams.push(outcome);
        }

        if (period === '1d') {
            whereClause += ' AND c.created_at >= CURRENT_DATE';
        } else if (period === '7d') {
            whereClause += ' AND c.created_at >= CURRENT_DATE - INTERVAL \'7 days\'';
        } else if (period === '30d') {
            whereClause += ' AND c.created_at >= CURRENT_DATE - INTERVAL \'30 days\'';
        }

        const result = await query(`
            SELECT c.id, c.status, c.outcome, c.duration, c.notes, c.answered, c.rejected,
                   c.created_at, c.updated_at,
                   co.first_name, co.last_name, co.phone, co.company, co.title,
                   camp.name as campaign_name
            FROM calls c
            JOIN contacts co ON c.contact_id = co.id
            LEFT JOIN campaigns camp ON c.campaign_id = camp.id
            WHERE ${whereClause}
            ORDER BY c.created_at DESC
            LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
        `, [...queryParams, parseInt(limit), parseInt(offset)]);

        const totalResult = await query(`
            SELECT COUNT(*) as total
            FROM calls c
            WHERE ${whereClause}
        `, queryParams);

        res.json({
            success: true,
            calls: result.rows.map(call => ({
                id: call.id,
                status: call.status,
                outcome: call.outcome,
                duration: call.duration,
                notes: call.notes,
                answered: call.answered,
                rejected: call.rejected,
                createdAt: call.created_at,
                updatedAt: call.updated_at,
                contact: {
                    firstName: call.first_name,
                    lastName: call.last_name,
                    phone: call.phone,
                    company: call.company,
                    title: call.title
                },
                campaign: {
                    name: call.campaign_name
                }
            })),
            pagination: {
                total: parseInt(totalResult.rows[0].total),
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: result.rows.length === parseInt(limit)
            }
        });

    } catch (error) {
        logger.error('Get my calls error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch call history'
        });
    }
});

// Get call statistics for agent
router.get('/stats', authenticateToken, async(req, res) => {
    try {
        const { period = '7d' } = req.query;

        let dateFilter = '';
        if (period === '1d') {
            dateFilter = 'AND c.created_at >= CURRENT_DATE';
        } else if (period === '7d') {
            dateFilter = 'AND c.created_at >= CURRENT_DATE - INTERVAL \'7 days\'';
        } else if (period === '30d') {
            dateFilter = 'AND c.created_at >= CURRENT_DATE - INTERVAL \'30 days\'';
        }

        const result = await query(`
            SELECT
                COUNT(*) as total_calls,
                COUNT(CASE WHEN c.answered = true THEN 1 END) as answered_calls,
                COUNT(CASE WHEN c.outcome = 'scheduled' THEN 1 END) as scheduled_calls,
                COUNT(CASE WHEN c.outcome = 'interested' THEN 1 END) as interested_calls,
                COUNT(CASE WHEN c.outcome = 'not_interested' THEN 1 END) as not_interested_calls,
                COUNT(CASE WHEN c.outcome = 'callback' THEN 1 END) as callback_calls,
                AVG(c.duration) as avg_duration,
                SUM(c.duration) as total_talk_time,
                COUNT(DISTINCT DATE(c.created_at)) as active_days
            FROM calls c
            WHERE c.initiated_by = $1
              AND c.organization_id = $2
              AND c.call_type = 'manual'
              ${dateFilter}
        `, [req.user.id, req.organizationId]);

        const stats = result.rows[0];

        res.json({
            success: true,
            stats: {
                totalCalls: parseInt(stats.total_calls) || 0,
                answeredCalls: parseInt(stats.answered_calls) || 0,
                scheduledCalls: parseInt(stats.scheduled_calls) || 0,
                interestedCalls: parseInt(stats.interested_calls) || 0,
                notInterestedCalls: parseInt(stats.not_interested_calls) || 0,
                callbackCalls: parseInt(stats.callback_calls) || 0,
                avgDuration: Math.round(parseFloat(stats.avg_duration) || 0),
                totalTalkTime: parseInt(stats.total_talk_time) || 0,
                activeDays: parseInt(stats.active_days) || 0,
                answerRate: stats.total_calls > 0 ?
                    Math.round((stats.answered_calls / stats.total_calls) * 100) : 0,
                conversionRate: stats.total_calls > 0 ?
                    Math.round((stats.scheduled_calls / stats.total_calls) * 100) : 0
            }
        });

    } catch (error) {
        logger.error('Get call stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch call statistics'
        });
    }
});

module.exports = router;
