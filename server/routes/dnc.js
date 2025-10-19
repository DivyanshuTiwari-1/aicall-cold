const express = require('express');
const Joi = require('joi');
const { query } = require('../config/database');
const logger = require('../utils/logger');

const router = express.Router();

// Validation schemas
const addDNCSchema = Joi.object({
    phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).required(),
    reason: Joi.string().valid('user_request', 'opt_out', 'complaint', 'invalid_number', 'other').required(),
    source: Joi.string().valid('manual', 'user_request', 'api', 'import').default('manual')
});

const bulkAddDNCSchema = Joi.object({
    phones: Joi.array().items(Joi.string().pattern(/^\+?[1-9]\d{1,14}$/)).min(1).max(1000).required()
});

// Get DNC records
router.get('/records', async(req, res) => {
    try {
        const { page = 1, limit = 50, source, search } = req.query;
        const offset = (page - 1) * limit;

        let whereClause = 'WHERE organization_id = $1';
        const params = [req.organizationId];
        let paramCount = 1;

        if (source) {
            paramCount++;
            whereClause += ` AND source = $${paramCount}`;
            params.push(source);
        }

        if (search) {
            paramCount++;
            whereClause += ` AND phone ILIKE $${paramCount}`;
            params.push(`%${search}%`);
        }

        // Get total count
        const countResult = await query(`
            SELECT COUNT(*) as total
            FROM dnc_registry
            ${whereClause}
        `, params);

        // Get records
        const result = await query(`
            SELECT id, phone, reason, source, added_date, added_by
            FROM dnc_registry
            ${whereClause}
            ORDER BY added_date DESC
            LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
        `, [...params, parseInt(limit), parseInt(offset)]);

        const records = result.rows.map(record => ({
            id: record.id,
            phone: record.phone,
            reason: record.reason,
            source: record.source,
            addedDate: record.added_date,
            addedBy: record.added_by
        }));

        res.json({
            success: true,
            records,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: parseInt(countResult.rows[0].total),
                pages: Math.ceil(countResult.rows[0].total / limit)
            }
        });

    } catch (error) {
        logger.error('DNC records fetch error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch DNC records'
        });
    }
});

// Add to DNC
router.post('/add', async(req, res) => {
    try {
        const { error, value } = addDNCSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: error.details.map(d => d.message)
            });
        }

        const { phone, reason, source } = value;

        // Check if already exists
        const existing = await query(
            'SELECT id FROM dnc_registry WHERE organization_id = $1 AND phone = $2', [req.organizationId, phone]
        );

        if (existing.rows.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Phone number already exists in DNC list'
            });
        }

        // Add to DNC
        const result = await query(`
            INSERT INTO dnc_registry (organization_id, phone, reason, source, added_by)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `, [req.organizationId, phone, reason, source, req.user.id]);

        const dncRecord = result.rows[0];

        // Log audit event
        await query(`
            INSERT INTO compliance_audit_logs (organization_id, event_type, event_data, user_id)
            VALUES ($1, $2, $3, $4)
        `, [
            req.organizationId,
            'dnc_added',
            JSON.stringify({
                phone: phone,
                reason: reason,
                source: source
            }),
            req.user.id
        ]);

        logger.info(`DNC entry added: ${phone} by user ${req.user.id}`);

        res.status(201).json({
            success: true,
            message: 'Number added to DNC list successfully',
            record: {
                id: dncRecord.id,
                phone: dncRecord.phone,
                reason: dncRecord.reason,
                source: dncRecord.source,
                addedDate: dncRecord.added_date
            }
        });

    } catch (error) {
        logger.error('DNC add error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to add to DNC list'
        });
    }
});

// Remove from DNC
router.delete('/remove/:id', async(req, res) => {
    try {
        const { id } = req.params;

        // Check if record exists
        const existing = await query(
            'SELECT phone FROM dnc_registry WHERE id = $1 AND organization_id = $2', [id, req.organizationId]
        );

        if (existing.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'DNC record not found'
            });
        }

        const phone = existing.rows[0].phone;

        // Remove from DNC
        await query(
            'DELETE FROM dnc_registry WHERE id = $1 AND organization_id = $2', [id, req.organizationId]
        );

        // Log audit event
        await query(`
            INSERT INTO compliance_audit_logs (organization_id, event_type, event_data, user_id)
            VALUES ($1, $2, $3, $4)
        `, [
            req.organizationId,
            'dnc_removed',
            JSON.stringify({
                phone: phone,
                removed_by: req.user.id
            }),
            req.user.id
        ]);

        logger.info(`DNC entry removed: ${phone} by user ${req.user.id}`);

        res.json({
            success: true,
            message: 'Number removed from DNC list successfully'
        });

    } catch (error) {
        logger.error('DNC remove error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to remove from DNC list'
        });
    }
});

// Check DNC status
router.get('/check/:phone', async(req, res) => {
    try {
        const { phone } = req.params;

        const result = await query(
            'SELECT id, reason, source, added_date FROM dnc_registry WHERE organization_id = $1 AND phone = $2', [req.organizationId, phone]
        );

        if (result.rows.length > 0) {
            res.json({
                success: true,
                isDNC: true,
                record: {
                    id: result.rows[0].id,
                    reason: result.rows[0].reason,
                    source: result.rows[0].source,
                    addedDate: result.rows[0].added_date
                }
            });
        } else {
            res.json({
                success: true,
                isDNC: false
            });
        }

    } catch (error) {
        logger.error('DNC check error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to check DNC status'
        });
    }
});

// Bulk add to DNC
router.post('/bulk-add', async(req, res) => {
    try {
        const { error, value } = bulkAddDNCSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: error.details.map(d => d.message)
            });
        }

        const { phones } = value;
        const added = [];
        const skipped = [];

        for (const phone of phones) {
            // Check if already exists
            const existing = await query(
                'SELECT id FROM dnc_registry WHERE organization_id = $1 AND phone = $2', [req.organizationId, phone]
            );

            if (existing.rows.length === 0) {
                // Add to DNC
                const result = await query(`
                    INSERT INTO dnc_registry (organization_id, phone, reason, source, added_by)
                    VALUES ($1, $2, $3, $4, $5)
                    RETURNING id
                `, [req.organizationId, phone, 'bulk_import', 'api', req.user.id]);

                added.push(phone);
            } else {
                skipped.push(phone);
            }
        }

        // Log audit event
        await query(`
            INSERT INTO compliance_audit_logs (organization_id, event_type, event_data, user_id)
            VALUES ($1, $2, $3, $4)
        `, [
            req.organizationId,
            'dnc_bulk_added',
            JSON.stringify({
                total: phones.length,
                added: added.length,
                skipped: skipped.length
            }),
            req.user.id
        ]);

        logger.info(`DNC bulk add: ${added.length} added, ${skipped.length} skipped by user ${req.user.id}`);

        res.json({
            success: true,
            message: `Bulk DNC operation completed`,
            results: {
                total: phones.length,
                added: added.length,
                skipped: skipped.length,
                addedPhones: added,
                skippedPhones: skipped
            }
        });

    } catch (error) {
        logger.error('DNC bulk add error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to bulk add to DNC list'
        });
    }
});

// Get DNC statistics
router.get('/stats', async(req, res) => {
    try {
        const result = await query(`
            SELECT
                COUNT(*) as total,
                COUNT(CASE WHEN source = 'manual' THEN 1 END) as manual,
                COUNT(CASE WHEN source = 'user_request' THEN 1 END) as user_request,
                COUNT(CASE WHEN source = 'api' THEN 1 END) as api,
                COUNT(CASE WHEN source = 'import' THEN 1 END) as imported,
                COUNT(CASE WHEN added_date >= CURRENT_DATE THEN 1 END) as added_today,
                COUNT(CASE WHEN added_date >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as added_this_week
            FROM dnc_registry
            WHERE organization_id = $1
        `, [req.organizationId]);

        const stats = result.rows[0];

        res.json({
            success: true,
            stats: {
                total: parseInt(stats.total),
                manual: parseInt(stats.manual),
                userRequest: parseInt(stats.user_request),
                api: parseInt(stats.api),
                imported: parseInt(stats.imported),
                addedToday: parseInt(stats.added_today),
                addedThisWeek: parseInt(stats.added_this_week)
            }
        });

    } catch (error) {
        logger.error('DNC stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch DNC statistics'
        });
    }
});

module.exports = router;