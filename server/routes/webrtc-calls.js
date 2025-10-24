const express = require('express');
const Joi = require('joi');
const { query } = require('../config/database');
const logger = require('../utils/logger');
const { authenticateToken, requireRole } = require('../middleware/auth');
const axios = require('axios');

const router = express.Router();

// Validation schemas
const startWebRTCCallSchema = Joi.object({
    contactId: Joi.string().uuid().required(),
    campaignId: Joi.string().uuid().optional()
});

/**
 * Start WebRTC call - Direct browser to customer call
 * No softphone needed!
 */
router.post('/start', authenticateToken, requireRole('agent'), async(req, res) => {
    try {
        const { error, value } = startWebRTCCallSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: error.details.map(d => d.message)
            });
        }

        const { contactId, campaignId } = value;

        // Verify contact exists
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

        // Check if contact is on DNC list
        const dncCheck = await query(
            'SELECT id, reason FROM dnc_registry WHERE organization_id = $1 AND phone = $2',
            [req.organizationId, contact.phone]
        );

        if (dncCheck.rows.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Contact is on Do Not Call list',
                isDNC: true,
                dncReason: dncCheck.rows[0].reason
            });
        }

        // Create call record
        // Telnyx rates: $0.011/min for calls
        const INITIAL_COST = 0.014;
        const callResult = await query(`
            INSERT INTO calls (organization_id, campaign_id, contact_id, initiated_by,
                             call_type, status, cost)
            VALUES ($1, $2, $3, $4, 'manual', 'initiated', $5)
            RETURNING id, created_at
        `, [req.organizationId, contact.campaign_id || campaignId, contactId, req.user.id, INITIAL_COST]);

        const call = callResult.rows[0];

        // Update or create assignment
        await query(`
            INSERT INTO lead_assignments (contact_id, assigned_to, organization_id, status)
            VALUES ($1, $2, $3, 'in_progress')
            ON CONFLICT (contact_id, assigned_to)
            DO UPDATE SET status = 'in_progress', updated_at = CURRENT_TIMESTAMP
        `, [contactId, req.user.id, req.organizationId]);

        // Log call event
        await query(`
            INSERT INTO call_events (call_id, event_type, event_data)
            VALUES ($1, 'webrtc_call_initiated', $2)
        `, [call.id, JSON.stringify({
            contact_name: `${contact.first_name} ${contact.last_name}`,
            phone: contact.phone,
            initiated_by: req.user.email,
            call_type: 'webrtc_browser'
        })]);

        logger.info(`WebRTC call initiated: ${call.id} for contact ${contactId}`);

        res.status(201).json({
            success: true,
            message: 'Call initiated successfully',
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

    } catch (error) {
        logger.error('Start WebRTC call error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to start call'
        });
    }
});

/**
 * Complete call and save conversation
 */
router.put('/:callId/complete', authenticateToken, requireRole('agent'), async(req, res) => {
    try {
        const { callId } = req.params;
        const {
            outcome,
            duration,
            notes,
            answered,
            rejected,
            transcript
        } = req.body;

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
            SET status = 'completed',
                outcome = $1,
                duration = $2,
                notes = $3,
                answered = $4,
                rejected = $5,
                transcript = $6,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $7
        `, [outcome, duration, notes || '', answered || false, rejected || false, transcript || '', callId]);

        // Update contact status based on outcome
        let contactStatus = 'contacted';
        if (outcome === 'not_interested' || outcome === 'dnc_request') {
            contactStatus = 'not_interested';
        } else if (outcome === 'scheduled' || outcome === 'interested') {
            contactStatus = 'interested';
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

        // Log call event
        await query(`
            INSERT INTO call_events (call_id, event_type, event_data)
            VALUES ($1, 'webrtc_call_completed', $2)
        `, [callId, JSON.stringify({
            outcome: outcome,
            duration: duration,
            answered: answered,
            has_transcript: !!transcript,
            completed_by: req.user.email
        })]);

        logger.info(`WebRTC call completed: ${callId} with outcome ${outcome}`);

        res.json({
            success: true,
            message: 'Call completed successfully',
            call: {
                id: callId,
                outcome: outcome,
                duration: duration,
                answered: answered,
                contactName: `${call.first_name} ${call.last_name}`
            }
        });

    } catch (error) {
        logger.error('Complete WebRTC call error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to complete call'
        });
    }
});

module.exports = router;
