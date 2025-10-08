const express = require('express');
const Joi = require('joi');
const { query } = require('../config/database');
const logger = require('../utils/logger');

const router = express.Router();

// Validation schemas
const campaignSchema = Joi.object({
    name: Joi.string().min(2).max(255).required(),
    type: Joi.string().valid('sales', 'recruitment').required(),
    voice_persona: Joi.string().default('professional'),
    auto_retry: Joi.boolean().default(true),
    best_time_enabled: Joi.boolean().default(true),
    emotion_detection: Joi.boolean().default(true),
    script_id: Joi.string().uuid().optional(),
    settings: Joi.object().default({})
});

const updateCampaignSchema = Joi.object({
    name: Joi.string().min(2).max(255).optional(),
    status: Joi.string().valid('draft', 'active', 'paused', 'completed').optional(),
    voice_persona: Joi.string().optional(),
    auto_retry: Joi.boolean().optional(),
    best_time_enabled: Joi.boolean().optional(),
    emotion_detection: Joi.boolean().optional(),
    script_id: Joi.string().uuid().optional(),
    settings: Joi.object().optional()
});

// Create new campaign
router.post('/', async(req, res) => {
    try {
        const { error, value } = campaignSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: error.details.map(d => d.message)
            });
        }

        const {
            name,
            type,
            voice_persona,
            auto_retry,
            best_time_enabled,
            emotion_detection,
            script_id,
            settings
        } = value;

        const result = await query(`
      INSERT INTO campaigns (
        organization_id, name, type, voice_persona, auto_retry,
        best_time_enabled, emotion_detection, script_id, settings
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
            req.organizationId,
            name,
            type,
            voice_persona,
            auto_retry,
            best_time_enabled,
            emotion_detection,
            script_id,
            JSON.stringify(settings)
        ]);

        const campaign = result.rows[0];

        logger.info(`Campaign created: ${campaign.id} by user ${req.user.id}`);

        res.status(201).json({
            success: true,
            message: 'Campaign created successfully',
            campaign: {
                id: campaign.id,
                name: campaign.name,
                type: campaign.type,
                status: campaign.status,
                voicePersona: campaign.voice_persona,
                autoRetry: campaign.auto_retry,
                bestTimeEnabled: campaign.best_time_enabled,
                emotionDetection: campaign.emotion_detection,
                scriptId: campaign.script_id,
                settings: campaign.settings,
                createdAt: campaign.created_at,
                updatedAt: campaign.updated_at
            }
        });

    } catch (error) {
        logger.error('Campaign creation error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create campaign'
        });
    }
});

// Get campaigns
router.get('/', async(req, res) => {
    try {
        const { status, type, limit = 50, offset = 0 } = req.query;

        let whereClause = 'WHERE c.organization_id = $1';
        const params = [req.organizationId];
        let paramCount = 1;

        if (status) {
            paramCount++;
            whereClause += ` AND status = $${paramCount}`;
            params.push(status);
        }

        if (type) {
            paramCount++;
            whereClause += ` AND type = $${paramCount}`;
            params.push(type);
        }

        const result = await query(`
      SELECT
        c.*,
        COUNT(ct.id) as contact_count,
        COUNT(cl.id) as call_count,
        COUNT(CASE WHEN cl.status = 'completed' THEN 1 END) as completed_calls
      FROM campaigns c
      LEFT JOIN contacts ct ON c.id = ct.campaign_id
      LEFT JOIN calls cl ON c.id = cl.campaign_id
      ${whereClause}
      GROUP BY c.id
      ORDER BY c.created_at DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `, [...params, parseInt(limit), parseInt(offset)]);

        const campaigns = result.rows.map(campaign => ({
            id: campaign.id,
            name: campaign.name,
            type: campaign.type,
            status: campaign.status,
            voicePersona: campaign.voice_persona,
            autoRetry: campaign.auto_retry,
            bestTimeEnabled: campaign.best_time_enabled,
            emotionDetection: campaign.emotion_detection,
            scriptId: campaign.script_id,
            settings: campaign.settings,
            contactCount: parseInt(campaign.contact_count),
            callCount: parseInt(campaign.call_count),
            completedCalls: parseInt(campaign.completed_calls),
            createdAt: campaign.created_at,
            updatedAt: campaign.updated_at
        }));

        res.json({
            success: true,
            campaigns,
            pagination: {
                limit: parseInt(limit),
                offset: parseInt(offset),
                total: campaigns.length
            }
        });

    } catch (error) {
        logger.error('Campaigns fetch error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch campaigns'
        });
    }
});

// Get single campaign
router.get('/:id', async(req, res) => {
    try {
        const { id } = req.params;

        const result = await query(`
      SELECT
        c.*,
        COUNT(ct.id) as contact_count,
        COUNT(cl.id) as call_count,
        COUNT(CASE WHEN cl.status = 'completed' THEN 1 END) as completed_calls,
        COUNT(CASE WHEN cl.outcome = 'scheduled' THEN 1 END) as scheduled_calls,
        COUNT(CASE WHEN cl.outcome = 'interested' THEN 1 END) as interested_calls
      FROM campaigns c
      LEFT JOIN contacts ct ON c.id = ct.campaign_id
      LEFT JOIN calls cl ON c.id = cl.campaign_id
      WHERE c.id = $1 AND c.organization_id = $2
      GROUP BY c.id
    `, [id, req.organizationId]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Campaign not found'
            });
        }

        const campaign = result.rows[0];

        res.json({
            success: true,
            campaign: {
                id: campaign.id,
                name: campaign.name,
                type: campaign.type,
                status: campaign.status,
                voicePersona: campaign.voice_persona,
                autoRetry: campaign.auto_retry,
                bestTimeEnabled: campaign.best_time_enabled,
                emotionDetection: campaign.emotion_detection,
                scriptId: campaign.script_id,
                settings: campaign.settings,
                contactCount: parseInt(campaign.contact_count),
                callCount: parseInt(campaign.call_count),
                completedCalls: parseInt(campaign.completed_calls),
                scheduledCalls: parseInt(campaign.scheduled_calls),
                interestedCalls: parseInt(campaign.interested_calls),
                createdAt: campaign.created_at,
                updatedAt: campaign.updated_at
            }
        });

    } catch (error) {
        logger.error('Campaign fetch error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch campaign'
        });
    }
});

// Update campaign
router.put('/:id', async(req, res) => {
    try {
        const { id } = req.params;
        const { error, value } = updateCampaignSchema.validate(req.body);

        if (error) {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: error.details.map(d => d.message)
            });
        }

        // Check if campaign exists
        const existingCampaign = await query(
            'SELECT id FROM campaigns WHERE id = $1 AND organization_id = $2', [id, req.organizationId]
        );

        if (existingCampaign.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Campaign not found'
            });
        }

        // Build update query dynamically
        const updates = [];
        const params = [];
        let paramCount = 0;

        Object.keys(value).forEach(key => {
            if (value[key] !== undefined) {
                paramCount++;
                updates.push(`${key} = $${paramCount}`);
                params.push(value[key]);
            }
        });

        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No valid fields to update'
            });
        }

        updates.push(`updated_at = CURRENT_TIMESTAMP`);
        params.push(id, req.organizationId);

        const result = await query(`
      UPDATE campaigns
      SET ${updates.join(', ')}
      WHERE id = $${paramCount + 1} AND organization_id = $${paramCount + 2}
      RETURNING *
    `, params);

        const campaign = result.rows[0];

        logger.info(`Campaign updated: ${campaign.id} by user ${req.user.id}`);

        res.json({
            success: true,
            message: 'Campaign updated successfully',
            campaign: {
                id: campaign.id,
                name: campaign.name,
                type: campaign.type,
                status: campaign.status,
                voicePersona: campaign.voice_persona,
                autoRetry: campaign.auto_retry,
                bestTimeEnabled: campaign.best_time_enabled,
                emotionDetection: campaign.emotion_detection,
                scriptId: campaign.script_id,
                settings: campaign.settings,
                updatedAt: campaign.updated_at
            }
        });

    } catch (error) {
        logger.error('Campaign update error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update campaign'
        });
    }
});

// Delete campaign
router.delete('/:id', async(req, res) => {
    try {
        const { id } = req.params;

        // Check if campaign exists
        const existingCampaign = await query(
            'SELECT id, name FROM campaigns WHERE id = $1 AND organization_id = $2', [id, req.organizationId]
        );

        if (existingCampaign.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Campaign not found'
            });
        }

        // Check if campaign has active calls
        const activeCalls = await query(
            'SELECT COUNT(*) as count FROM calls WHERE campaign_id = $1 AND status IN ($2, $3)', [id, 'initiated', 'in_progress']
        );

        if (parseInt(activeCalls.rows[0].count) > 0) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete campaign with active calls'
            });
        }

        await query('DELETE FROM campaigns WHERE id = $1 AND organization_id = $2', [id, req.organizationId]);

        logger.info(`Campaign deleted: ${id} by user ${req.user.id}`);

        res.json({
            success: true,
            message: 'Campaign deleted successfully'
        });

    } catch (error) {
        logger.error('Campaign deletion error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete campaign'
        });
    }
});

// Start campaign
router.post('/:id/start', async(req, res) => {
    try {
        const { id } = req.params;

        // Update campaign status to active
        const result = await query(`
            UPDATE campaigns
            SET status = 'active', updated_at = NOW()
            WHERE id = $1 AND organization_id = $2
            RETURNING *
        `, [id, req.organizationId]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Campaign not found'
            });
        }

        logger.info(`Campaign ${id} started by organization ${req.organizationId}`);
        res.json({
            success: true,
            message: 'Campaign started successfully',
            campaign: result.rows[0]
        });

    } catch (error) {
        logger.error('Campaign start error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to start campaign'
        });
    }
});

// Pause campaign
router.post('/:id/pause', async(req, res) => {
    try {
        const { id } = req.params;

        // Update campaign status to paused
        const result = await query(`
            UPDATE campaigns
            SET status = 'paused', updated_at = NOW()
            WHERE id = $1 AND organization_id = $2
            RETURNING *
        `, [id, req.organizationId]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Campaign not found'
            });
        }

        logger.info(`Campaign ${id} paused by organization ${req.organizationId}`);
        res.json({
            success: true,
            message: 'Campaign paused successfully',
            campaign: result.rows[0]
        });

    } catch (error) {
        logger.error('Campaign pause error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to pause campaign'
        });
    }
});

// Stop campaign
router.post('/:id/stop', async(req, res) => {
    try {
        const { id } = req.params;

        // Update campaign status to completed
        const result = await query(`
            UPDATE campaigns
            SET status = 'completed', updated_at = NOW()
            WHERE id = $1 AND organization_id = $2
            RETURNING *
        `, [id, req.organizationId]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Campaign not found'
            });
        }

        logger.info(`Campaign ${id} stopped by organization ${req.organizationId}`);
        res.json({
            success: true,
            message: 'Campaign stopped successfully',
            campaign: result.rows[0]
        });

    } catch (error) {
        logger.error('Campaign stop error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to stop campaign'
        });
    }
});

module.exports = router;