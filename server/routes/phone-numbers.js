const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const logger = require('../utils/logger');
const Joi = require('joi');

// Validation schemas
const addNumberSchema = Joi.object({
    phoneNumber: Joi.string().required(),
    provider: Joi.string().valid('telnyx', 'twilio').default('telnyx'),
    countryCode: Joi.string().length(2).required(),
    capabilities: Joi.object({
        voice: Joi.boolean().default(true),
        sms: Joi.boolean().default(false)
    }).default({ voice: true, sms: false })
});

const assignNumberSchema = Joi.object({
    agentId: Joi.string().uuid().required(),
    dailyLimit: Joi.number().integer().min(1).max(1000).required(),
    allowedCountries: Joi.array().items(Joi.string().length(2)).min(1).required()
});

// Get all phone numbers for organization
router.get('/', authenticateToken, requireRole('admin', 'manager'), async (req, res) => {
    try {
        const { organizationId } = req;
        const { status = 'all', assigned = 'all' } = req.query;

        let whereClause = 'WHERE pn.organization_id = $1';
        const params = [organizationId];

        if (status !== 'all') {
            params.push(status);
            whereClause += ` AND pn.status = $${params.length}`;
        }

        if (assigned === 'true') {
            whereClause += ' AND pn.assigned_to IS NOT NULL';
        } else if (assigned === 'false') {
            whereClause += ' AND pn.assigned_to IS NULL';
        }

        const result = await query(`
            SELECT
                pn.id,
                pn.phone_number,
                pn.provider,
                pn.country_code,
                pn.capabilities,
                pn.status,
                pn.assigned_to,
                pn.created_at,
                u.first_name as agent_first_name,
                u.last_name as agent_last_name,
                u.email as agent_email,
                apn.daily_limit,
                apn.allowed_countries,
                apn.calls_made_today
            FROM phone_numbers pn
            LEFT JOIN users u ON pn.assigned_to = u.id
            LEFT JOIN agent_phone_numbers apn ON pn.id = apn.phone_number_id AND pn.assigned_to = apn.agent_id
            ${whereClause}
            ORDER BY pn.created_at DESC
        `, params);

        // Ensure JSON fields are properly formatted
        const formattedRows = result.rows.map(row => ({
            ...row,
            capabilities: typeof row.capabilities === 'string' ? JSON.parse(row.capabilities) : row.capabilities,
            allowed_countries: row.allowed_countries ?
                (typeof row.allowed_countries === 'string' ? row.allowed_countries : JSON.stringify(row.allowed_countries))
                : null
        }));

        res.json({
            success: true,
            phoneNumbers: formattedRows
        });

    } catch (error) {
        logger.error('Get phone numbers error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch phone numbers'
        });
    }
});

// Add a new phone number
router.post('/', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        const { error, value } = addNumberSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: error.details.map(d => d.message)
            });
        }

        const { phoneNumber, provider, countryCode, capabilities } = value;

        // Check if number already exists
        const existingNumber = await query(
            'SELECT id FROM phone_numbers WHERE phone_number = $1',
            [phoneNumber]
        );

        if (existingNumber.rows.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Phone number already exists'
            });
        }

        const result = await query(`
            INSERT INTO phone_numbers (
                organization_id, phone_number, provider, country_code,
                capabilities, status
            )
            VALUES ($1, $2, $3, $4, $5, 'active')
            RETURNING *
        `, [req.organizationId, phoneNumber, provider, countryCode, JSON.stringify(capabilities)]);

        logger.info(`Phone number added: ${phoneNumber} by ${req.user.email}`);

        res.status(201).json({
            success: true,
            message: 'Phone number added successfully',
            phoneNumber: result.rows[0]
        });

    } catch (error) {
        logger.error('Add phone number error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to add phone number'
        });
    }
});

// Bulk upload phone numbers
router.post('/bulk-upload', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        const { phoneNumbers } = req.body;

        if (!Array.isArray(phoneNumbers) || phoneNumbers.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'phoneNumbers array is required'
            });
        }

        const results = {
            added: [],
            skipped: [],
            errors: []
        };

        for (const num of phoneNumbers) {
            try {
                const { error, value } = addNumberSchema.validate(num);
                if (error) {
                    results.errors.push({
                        phoneNumber: num.phoneNumber,
                        error: error.details[0].message
                    });
                    continue;
                }

                // Check if exists
                const existing = await query(
                    'SELECT id FROM phone_numbers WHERE phone_number = $1',
                    [value.phoneNumber]
                );

                if (existing.rows.length > 0) {
                    results.skipped.push(value.phoneNumber);
                    continue;
                }

                // Insert
                await query(`
                    INSERT INTO phone_numbers (
                        organization_id, phone_number, provider, country_code,
                        capabilities, status
                    )
                    VALUES ($1, $2, $3, $4, $5, 'active')
                `, [req.organizationId, value.phoneNumber, value.provider, value.countryCode, JSON.stringify(value.capabilities)]);

                results.added.push(value.phoneNumber);

            } catch (err) {
                results.errors.push({
                    phoneNumber: num.phoneNumber,
                    error: err.message
                });
            }
        }

        logger.info(`Bulk upload completed: ${results.added.length} added, ${results.skipped.length} skipped, ${results.errors.length} errors`);

        res.json({
            success: true,
            message: `Bulk upload completed`,
            results
        });

    } catch (error) {
        logger.error('Bulk upload phone numbers error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to upload phone numbers'
        });
    }
});

// Assign phone number to agent
router.post('/:numberId/assign', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        const { numberId } = req.params;
        const { error, value } = assignNumberSchema.validate(req.body);

        if (error) {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: error.details.map(d => d.message)
            });
        }

        const { agentId, dailyLimit, allowedCountries } = value;

        // Verify phone number exists and is available
        const numberResult = await query(
            'SELECT id, phone_number FROM phone_numbers WHERE id = $1 AND organization_id = $2',
            [numberId, req.organizationId]
        );

        if (numberResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Phone number not found'
            });
        }

        // Verify agent exists
        const agentResult = await query(
            'SELECT id, first_name, last_name FROM users WHERE id = $1 AND organization_id = $2 AND role_type = $3',
            [agentId, req.organizationId, 'agent']
        );

        if (agentResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Agent not found'
            });
        }

        // Update phone number assignment
        await query(
            'UPDATE phone_numbers SET assigned_to = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [agentId, numberId]
        );

        // Insert or update agent_phone_numbers
        await query(`
            INSERT INTO agent_phone_numbers (
                agent_id, phone_number_id, organization_id, daily_limit,
                allowed_countries, calls_made_today
            )
            VALUES ($1, $2, $3, $4, $5, 0)
            ON CONFLICT (agent_id, phone_number_id)
            DO UPDATE SET
                daily_limit = $4,
                allowed_countries = $5,
                updated_at = CURRENT_TIMESTAMP
        `, [agentId, numberId, req.organizationId, dailyLimit, JSON.stringify(allowedCountries)]);

        logger.info(`Phone number ${numberResult.rows[0].phone_number} assigned to agent ${agentResult.rows[0].first_name} ${agentResult.rows[0].last_name}`);

        res.json({
            success: true,
            message: 'Phone number assigned successfully'
        });

    } catch (error) {
        logger.error('Assign phone number error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to assign phone number'
        });
    }
});

// Unassign phone number from agent
router.post('/:numberId/unassign', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        const { numberId } = req.params;

        await query(
            'UPDATE phone_numbers SET assigned_to = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND organization_id = $2',
            [numberId, req.organizationId]
        );

        await query(
            'DELETE FROM agent_phone_numbers WHERE phone_number_id = $1',
            [numberId]
        );

        logger.info(`Phone number unassigned: ${numberId}`);

        res.json({
            success: true,
            message: 'Phone number unassigned successfully'
        });

    } catch (error) {
        logger.error('Unassign phone number error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to unassign phone number'
        });
    }
});

// Delete phone number
router.delete('/:numberId', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        const { numberId } = req.params;

        // Check if number is assigned
        const numberResult = await query(
            'SELECT assigned_to FROM phone_numbers WHERE id = $1 AND organization_id = $2',
            [numberId, req.organizationId]
        );

        if (numberResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Phone number not found'
            });
        }

        if (numberResult.rows[0].assigned_to) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete assigned phone number. Unassign it first.'
            });
        }

        await query(
            'DELETE FROM phone_numbers WHERE id = $1 AND organization_id = $2',
            [numberId, req.organizationId]
        );

        logger.info(`Phone number deleted: ${numberId}`);

        res.json({
            success: true,
            message: 'Phone number deleted successfully'
        });

    } catch (error) {
        logger.error('Delete phone number error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete phone number'
        });
    }
});

// Get agent's assigned numbers
router.get('/agent/:agentId', authenticateToken, async (req, res) => {
    try {
        const { agentId } = req.params;

        const result = await query(`
            SELECT
                pn.id,
                pn.phone_number,
                pn.provider,
                pn.country_code,
                apn.daily_limit,
                apn.allowed_countries,
                apn.calls_made_today
            FROM phone_numbers pn
            JOIN agent_phone_numbers apn ON pn.id = apn.phone_number_id
            WHERE pn.assigned_to = $1 AND pn.organization_id = $2 AND pn.status = 'active'
        `, [agentId, req.organizationId]);

        // Ensure JSON fields are properly formatted
        const formattedRows = result.rows.map(row => ({
            ...row,
            allowed_countries: row.allowed_countries ?
                (typeof row.allowed_countries === 'string' ? row.allowed_countries : JSON.stringify(row.allowed_countries))
                : '[]'
        }));

        res.json({
            success: true,
            phoneNumbers: formattedRows
        });

    } catch (error) {
        logger.error('Get agent phone numbers error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch agent phone numbers'
        });
    }
});

module.exports = router;
