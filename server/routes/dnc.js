const express = require('express');
const Joi = require('joi');
const { query } = require('../config/database');
const logger = require('../utils/logger');

const router = express.Router();

// Validation schemas
const dncSchema = Joi.object({
    phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).required(),
    reason: Joi.string().max(255).optional()
});

// Check if phone is on DNC list
router.post('/check', async(req, res) => {
    try {
        const { phone } = req.body;

        if (!phone) {
            return res.status(400).json({
                success: false,
                message: 'Phone number is required'
            });
        }

        const result = await query(
            'SELECT id, reason, created_at FROM dnc_registry WHERE organization_id = $1 AND phone = $2', [req.organizationId, phone]
        );

        const isOnDNC = result.rows.length > 0;

        res.json({
            success: true,
            isOnDNC,
            dncRecord: isOnDNC ? {
                id: result.rows[0].id,
                reason: result.rows[0].reason,
                addedAt: result.rows[0].created_at
            } : null
        });

    } catch (error) {
        logger.error('DNC check error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to check DNC status'
        });
    }
});

// Add phone to DNC list
router.post('/add', async(req, res) => {
    try {
        const { error, value } = dncSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: error.details.map(d => d.message)
            });
        }

        const { phone, reason } = value;

        // Check if already on DNC list
        const existingDNC = await query(
            'SELECT id FROM dnc_registry WHERE organization_id = $1 AND phone = $2', [req.organizationId, phone]
        );

        if (existingDNC.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'Phone number already on DNC list'
            });
        }

        const result = await query(`
      INSERT INTO dnc_registry (organization_id, phone, reason, source)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [req.organizationId, phone, reason, 'manual']);

        const dncRecord = result.rows[0];

        logger.info(`Phone added to DNC: ${phone} by user ${req.user.id}`);

        res.status(201).json({
            success: true,
            message: 'Phone number added to DNC list',
            dncRecord: {
                id: dncRecord.id,
                phone: dncRecord.phone,
                reason: dncRecord.reason,
                source: dncRecord.source,
                createdAt: dncRecord.created_at
            }
        });

    } catch (error) {
        logger.error('DNC add error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to add phone to DNC list'
        });
    }
});

// Get DNC list
router.get('/', async(req, res) => {
    try {
        const { limit = 50, offset = 0, search } = req.query;

        let whereClause = 'WHERE organization_id = $1';
        const params = [req.organizationId];
        let paramCount = 1;

        if (search) {
            paramCount++;
            whereClause += ` AND phone ILIKE $${paramCount}`;
            params.push(`%${search}%`);
        }

        const result = await query(`
      SELECT *
      FROM dnc_registry
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `, [...params, parseInt(limit), parseInt(offset)]);

        const dncRecords = result.rows.map(record => ({
            id: record.id,
            phone: record.phone,
            reason: record.reason,
            source: record.source,
            createdAt: record.created_at
        }));

        res.json({
            success: true,
            dncRecords,
            pagination: {
                limit: parseInt(limit),
                offset: parseInt(offset),
                total: dncRecords.length
            }
        });

    } catch (error) {
        logger.error('DNC list fetch error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch DNC list'
        });
    }
});

// Remove phone from DNC list
router.delete('/:id', async(req, res) => {
    try {
        const { id } = req.params;

        const result = await query(
            'DELETE FROM dnc_registry WHERE id = $1 AND organization_id = $2 RETURNING phone', [id, req.organizationId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'DNC record not found'
            });
        }

        logger.info(`Phone removed from DNC: ${result.rows[0].phone} by user ${req.user.id}`);

        res.json({
            success: true,
            message: 'Phone number removed from DNC list'
        });

    } catch (error) {
        logger.error('DNC removal error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to remove phone from DNC list'
        });
    }
});

module.exports = router;