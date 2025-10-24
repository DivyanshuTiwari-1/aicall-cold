const express = require('express');
const Joi = require('joi');
const { query } = require('../config/database');
const logger = require('../utils/logger');
const { authenticateToken, requireRole } = require('../middleware/auth');
const axios = require('axios');

const router = express.Router();

// Telnyx API configuration for WebRTC
const TELNYX_API_KEY = process.env.TELNYX_API_KEY;
const TELNYX_FROM_NUMBER = process.env.TELNYX_CALLER_ID || process.env.TELNYX_PHONE_NUMBER;
const TELNYX_SIP_USERNAME = process.env.TELNYX_SIP_USERNAME;
const TELNYX_SIP_PASSWORD = process.env.TELNYX_SIP_PASSWORD;

/**
 * REAL BROWSER CALLING - Telnyx WebRTC
 * 1. Agent clicks call in browser
 * 2. Browser gets Telnyx WebRTC credentials
 * 3. Telnyx dials customer directly
 * 4. Customer answers → audio via WebRTC
 * 5. Conversation happens (REAL AUDIO!)
 * 6. Call ends → saved to history
 */

const startCallSchema = Joi.object({
    contactId: Joi.string().uuid().required(),
    campaignId: Joi.string().uuid().optional()
});

// Get Telnyx WebRTC token for browser
router.post('/webrtc-token', authenticateToken, requireRole('agent'), async(req, res) => {
    try {
        if (!TELNYX_API_KEY) {
            return res.status(500).json({
                success: false,
                message: 'Telnyx API key not configured'
            });
        }

        // Get agent's assigned phone number
        const phoneNumberResult = await query(`
            SELECT pn.id, pn.phone_number, pn.provider, apn.daily_limit, apn.calls_made_today
            FROM phone_numbers pn
            JOIN agent_phone_numbers apn ON pn.id = apn.phone_number_id
            WHERE pn.assigned_to = $1 AND pn.organization_id = $2 AND pn.status = 'active'
            ORDER BY apn.calls_made_today ASC
            LIMIT 1
        `, [req.user.id, req.organizationId]);

        // Use assigned number or fall back to env variable
        let callerIdNumber = TELNYX_FROM_NUMBER;
        let phoneNumberInfo = null;

        if (phoneNumberResult.rows.length > 0) {
            const assignedNumber = phoneNumberResult.rows[0];
            callerIdNumber = assignedNumber.phone_number;
            phoneNumberInfo = {
                id: assignedNumber.id,
                phoneNumber: assignedNumber.phone_number,
                dailyLimit: assignedNumber.daily_limit,
                callsMadeToday: assignedNumber.calls_made_today,
                remaining: assignedNumber.daily_limit - assignedNumber.calls_made_today
            };
            logger.info(`Using assigned number ${callerIdNumber} for agent ${req.user.id}`);
        } else {
            logger.warn(`No assigned number for agent ${req.user.id}, using env default: ${callerIdNumber}`);
        }

        // Try to create a Telnyx WebRTC token using their API
        // This creates a temporary SIP credential for WebRTC
        try {
            const response = await axios.post(
                'https://api.telnyx.com/v2/credential_connections',
                {
                    connection_name: `webrtc-${req.user.id}-${Date.now()}`,
                    user_name: `agent${req.user.id}`,
                    password: `temp-${Math.random().toString(36).substring(2, 15)}`,
                    sip_uri_calling_preference: ['tls', 'tcp', 'udp']
                },
                {
                    headers: {
                        'Authorization': `Bearer ${TELNYX_API_KEY}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            const cred = response.data.data;
            logger.info(`Telnyx WebRTC credential created for user ${req.user.id}`);

            res.json({
                success: true,
                token: {
                    username: cred.user_name,
                    password: cred.password,
                    sipServer: 'rtc.telnyx.com',
                    callerIdNumber: callerIdNumber
                },
                phoneNumber: phoneNumberInfo
            });

        } catch (apiError) {
            // Fallback to SIP credentials if API fails
            logger.warn('Telnyx API credential creation failed, using SIP credentials:', apiError.message);

            if (!TELNYX_SIP_USERNAME || !TELNYX_SIP_PASSWORD) {
                throw new Error('No Telnyx credentials available');
            }

            res.json({
                success: true,
                token: {
                    username: TELNYX_SIP_USERNAME,
                    password: TELNYX_SIP_PASSWORD,
                    sipServer: 'sip.telnyx.com',
                    callerIdNumber: callerIdNumber
                },
                phoneNumber: phoneNumberInfo
            });
        }

    } catch (error) {
        logger.error('WebRTC token generation error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate WebRTC token: ' + error.message
        });
    }
});

// Start simple direct call
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

        // Get contact details
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

        // Get agent's assigned phone number
        const phoneNumberResult = await query(`
            SELECT pn.id, pn.phone_number, pn.provider, apn.daily_limit, apn.calls_made_today
            FROM phone_numbers pn
            JOIN agent_phone_numbers apn ON pn.id = apn.phone_number_id
            WHERE pn.assigned_to = $1 AND pn.organization_id = $2 AND pn.status = 'active'
            ORDER BY apn.calls_made_today ASC
            LIMIT 1
        `, [req.user.id, req.organizationId]);

        // Use assigned number or fall back to env variable
        let fromNumber = TELNYX_FROM_NUMBER;
        let assignedNumber = null;

        if (phoneNumberResult.rows.length > 0) {
            assignedNumber = phoneNumberResult.rows[0];
            fromNumber = assignedNumber.phone_number;

            // Check daily limit only if using assigned number
            if (assignedNumber.calls_made_today >= assignedNumber.daily_limit) {
                return res.status(400).json({
                    success: false,
                    message: `Daily call limit reached (${assignedNumber.daily_limit} calls). Please contact your administrator.`,
                    limitReached: true,
                    dailyLimit: assignedNumber.daily_limit,
                    callsMadeToday: assignedNumber.calls_made_today
                });
            }

            logger.info(`Using assigned number ${fromNumber} for simple call by agent ${req.user.id}`);
        } else {
            logger.warn(`No assigned number for agent ${req.user.id}, using env default for simple call`);
        }

        // Create call record
        // Telnyx rates: $0.011/min for calls
        const INITIAL_COST = 0.014;
        const callResult = await query(`
            INSERT INTO calls (organization_id, campaign_id, contact_id, initiated_by,
                             call_type, status, cost, from_number, to_number)
            VALUES ($1, $2, $3, $4, 'manual', 'initiated', $5, $6, $7)
            RETURNING id, created_at
        `, [
            req.organizationId,
            contact.campaign_id || campaignId,
            contactId,
            req.user.id,
            INITIAL_COST,
            fromNumber,
            contact.phone
        ]);

        const call = callResult.rows[0];

        // Update/create assignment
        await query(`
            INSERT INTO lead_assignments (contact_id, assigned_to, organization_id, status)
            VALUES ($1, $2, $3, 'in_progress')
            ON CONFLICT (contact_id, assigned_to)
            DO UPDATE SET status = 'in_progress', updated_at = CURRENT_TIMESTAMP
        `, [contactId, req.user.id, req.organizationId]);

        // Increment daily call counter if using assigned number
        if (assignedNumber) {
            await query(`
                UPDATE agent_phone_numbers
                SET calls_made_today = calls_made_today + 1, updated_at = CURRENT_TIMESTAMP
                WHERE phone_number_id = $1 AND agent_id = $2
            `, [assignedNumber.id, req.user.id]);
        }

        // Log event
        await query(`
            INSERT INTO call_events (call_id, event_type, event_data)
            VALUES ($1, 'simple_call_initiated', $2)
        `, [call.id, JSON.stringify({
            contact_name: `${contact.first_name} ${contact.last_name}`,
            phone: contact.phone,
            initiated_by: req.user.email,
            from_number: fromNumber,
            using_assigned_number: !!assignedNumber
        })]);

        logger.info(`Simple call initiated: ${call.id} to ${contact.phone} using ${fromNumber}`);

        // TODO: Initiate actual Telnyx call here
        // For now, we return success and handle call in browser

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
                createdAt: call.created_at,
                fromNumber: fromNumber
            },
            phoneNumberInfo: assignedNumber ? {
                id: assignedNumber.id,
                phoneNumber: assignedNumber.phone_number,
                dailyLimit: assignedNumber.daily_limit,
                callsMadeToday: assignedNumber.calls_made_today + 1,
                remaining: assignedNumber.daily_limit - assignedNumber.calls_made_today - 1
            } : null
        });

    } catch (error) {
        logger.error('Start simple call error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to start call'
        });
    }
});

// Complete call
router.put('/:callId/complete', authenticateToken, async(req, res) => {
    try {
        const { callId } = req.params;
        let {
            outcome = 'no_answer',
            duration = 0,
            notes = '',
            answered = false,
            transcript = ''
        } = req.body;

        // Validate outcome against allowed values
        const validOutcomes = [
            'scheduled', 'interested', 'not_interested', 'callback',
            'voicemail', 'busy', 'no_answer', 'failed', 'answered',
            'rejected', 'missed', 'wrong_number', 'dnc_request'
        ];

        if (!validOutcomes.includes(outcome)) {
            // Default to 'answered' if call lasted more than 5 seconds, otherwise 'no_answer'
            outcome = duration > 5 ? 'answered' : 'no_answer';
        }

        // Verify call
        const callResult = await query(`
            SELECT c.id, c.contact_id, co.phone, co.first_name, co.last_name
            FROM calls c
            JOIN contacts co ON c.contact_id = co.id
            WHERE c.id = $1 AND c.initiated_by = $2
        `, [callId, req.user.id]);

        if (callResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Call not found'
            });
        }

        const call = callResult.rows[0];

        // Update call
        await query(`
            UPDATE calls
            SET status = 'completed',
                outcome = $1,
                duration = $2,
                notes = $3,
                answered = $4,
                transcript = $5,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $6
        `, [outcome, duration, notes, answered, transcript, callId]);

        // Update contact
        let contactStatus = 'contacted';
        if (outcome === 'not_interested' || outcome === 'dnc_request') {
            contactStatus = 'not_interested';
        } else if (outcome === 'scheduled' || outcome === 'interested') {
            contactStatus = 'interested';
        }

        await query(`
            UPDATE contacts
            SET status = $1, last_contacted = CURRENT_TIMESTAMP
            WHERE id = $2
        `, [contactStatus, call.contact_id]);

        // Complete assignment
        await query(`
            UPDATE lead_assignments
            SET status = 'completed'
            WHERE contact_id = $1 AND assigned_to = $2
        `, [call.contact_id, req.user.id]);

        // Handle DNC
        if (outcome === 'dnc_request') {
            await query(`
                INSERT INTO dnc_registry (organization_id, phone, reason, source)
                VALUES ($1, $2, 'DNC request', 'agent')
                ON CONFLICT (organization_id, phone) DO NOTHING
            `, [req.organizationId, call.phone]);
        }

        // Log event
        await query(`
            INSERT INTO call_events (call_id, event_type, event_data)
            VALUES ($1, 'call_completed', $2)
        `, [callId, JSON.stringify({
            outcome,
            duration,
            answered,
            has_transcript: !!transcript
        })]);

        logger.info(`Call completed: ${callId}, duration: ${duration}s, outcome: ${outcome}`);

        res.json({
            success: true,
            message: 'Call completed and saved to history',
            call: {
                id: callId,
                outcome,
                duration,
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

// Get call history
router.get('/history', authenticateToken, async(req, res) => {
    try {
        const { limit = 50, offset = 0, period = '7d' } = req.query;

        let dateFilter = '';
        if (period === '1d') {
            dateFilter = 'AND c.created_at >= CURRENT_DATE';
        } else if (period === '7d') {
            dateFilter = "AND c.created_at >= CURRENT_DATE - INTERVAL '7 days'";
        } else if (period === '30d') {
            dateFilter = "AND c.created_at >= CURRENT_DATE - INTERVAL '30 days'";
        }

        const result = await query(`
            SELECT
                c.id, c.status, c.outcome, c.duration, c.notes, c.answered,
                c.transcript, c.created_at, c.updated_at, c.from_number, c.to_number,
                co.first_name, co.last_name, co.phone, co.company, co.title,
                camp.name as campaign_name
            FROM calls c
            JOIN contacts co ON c.contact_id = co.id
            LEFT JOIN campaigns camp ON c.campaign_id = camp.id
            WHERE c.initiated_by = $1
              AND c.organization_id = $2
              ${dateFilter}
            ORDER BY c.created_at DESC
            LIMIT $3 OFFSET $4
        `, [req.user.id, req.organizationId, parseInt(limit), parseInt(offset)]);

        res.json({
            success: true,
            calls: result.rows.map(call => ({
                id: call.id,
                status: call.status,
                outcome: call.outcome,
                duration: call.duration,
                notes: call.notes,
                answered: call.answered,
                transcript: call.transcript,
                createdAt: call.created_at,
                updatedAt: call.updated_at,
                fromNumber: call.from_number,
                toNumber: call.to_number,
                contact: {
                    firstName: call.first_name,
                    lastName: call.last_name,
                    phone: call.phone,
                    company: call.company,
                    title: call.title
                },
                campaign: call.campaign_name
            })),
            pagination: {
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: result.rows.length === parseInt(limit)
            }
        });

    } catch (error) {
        logger.error('Get call history error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch call history'
        });
    }
});

module.exports = router;
