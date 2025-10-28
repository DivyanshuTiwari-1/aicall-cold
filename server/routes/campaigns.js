const express = require('express');
const Joi = require('joi');
const { query } = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// Validation schemas
const createCampaignSchema = Joi.object({
    name: Joi.string().min(1).max(255).required(),
    type: Joi.string().valid('sales', 'marketing', 'follow_up', 'recruitment').required(),
    status: Joi.string().valid('draft', 'active', 'paused', 'completed').default('draft'),
    description: Joi.string().max(1000).optional(),
    voice_persona: Joi.string().valid('professional', 'casual', 'empathetic', 'enthusiastic').default('professional'),
    language: Joi.string().default('en-US'),
    accent: Joi.string().default('professional'),
    auto_retry: Joi.boolean().default(true),
    best_time_enabled: Joi.boolean().default(true),
    emotion_detection: Joi.boolean().default(true),
    script_id: Joi.string().uuid().optional(),
    callSettings: Joi.object({
        maxConcurrentCalls: Joi.number().integer().min(1).max(10).default(2),
        retryAttempts: Joi.number().integer().min(0).max(5).default(3),
        retryDelayMinutes: Joi.number().integer().min(1).max(1440).default(30),
        callTimeoutSeconds: Joi.number().integer().min(10).max(300).default(30)
    }).optional(),
    settings: Joi.object().default({})
});

const updateCampaignSchema = Joi.object({
    name: Joi.string().min(1).max(255).optional(),
    type: Joi.string().valid('sales', 'marketing', 'follow_up', 'recruitment').optional(),
    status: Joi.string().valid('draft', 'active', 'paused', 'completed').optional(),
    description: Joi.string().max(1000).optional(),
    voice_persona: Joi.string().valid('professional', 'casual', 'empathetic', 'enthusiastic').optional(),
    language: Joi.string().optional(),
    accent: Joi.string().optional(),
    auto_retry: Joi.boolean().optional(),
    best_time_enabled: Joi.boolean().optional(),
    emotion_detection: Joi.boolean().optional(),
    script_id: Joi.string().uuid().optional(),
    callSettings: Joi.object({
        maxConcurrentCalls: Joi.number().integer().min(1).max(10).optional(),
        retryAttempts: Joi.number().integer().min(0).max(5).optional(),
        retryDelayMinutes: Joi.number().integer().min(1).max(1440).optional(),
        callTimeoutSeconds: Joi.number().integer().min(10).max(300).optional()
    }).optional(),
    settings: Joi.object().optional()
});

// Get all campaigns
router.get('/', authenticateToken, requireRole('admin', 'manager', 'agent'), async(req, res) => {
    try {
        const { status, type } = req.query;

        let whereClause = 'WHERE c.organization_id = $1';
        const params = [req.organizationId];
        let paramCount = 1;

        if (status) {
            paramCount++;
            whereClause += ` AND c.status = $${paramCount}`;
            params.push(status);
        }

        if (type) {
            paramCount++;
            whereClause += ` AND c.type = $${paramCount}`;
            params.push(type);
        }

        const result = await query(`
            SELECT
                c.*,
                COUNT(ct.id) as contact_count,
                COUNT(call.id) as calls_made
            FROM campaigns c
            LEFT JOIN contacts ct ON c.id = ct.campaign_id
            LEFT JOIN calls call ON c.id = call.campaign_id
            ${whereClause}
            GROUP BY c.id
            ORDER BY c.created_at DESC
        `, params);

        // Get active queue status from simple queue service
        const simpleQueue = require('../services/simple-automated-queue');

        const campaigns = result.rows.map(campaign => {
            // Check if this campaign has an active queue
            const queueStatus = simpleQueue.getQueueStatus(campaign.id);
            const isQueueActive = queueStatus && queueStatus.status === 'running';

            return {
                id: campaign.id,
                name: campaign.name,
                type: campaign.type,
                status: campaign.status,
                description: campaign.description || '',
                voicePersona: campaign.voice_persona,
                language: campaign.language,
                accent: campaign.accent,
                autoRetry: campaign.auto_retry,
                bestTimeEnabled: campaign.best_time_enabled,
                emotionDetection: campaign.emotion_detection,
                scriptId: campaign.script_id,
                callSettings: campaign.call_settings || {},
                settings: campaign.settings || {},
                contactCount: parseInt(campaign.contact_count),
                callsMade: parseInt(campaign.calls_made),
                automatedCallsActive: isQueueActive,
                createdAt: campaign.created_at,
                updatedAt: campaign.updated_at
            };
        });

        res.json({
            success: true,
            campaigns
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
router.get('/:id', authenticateToken, requireRole('admin', 'manager', 'agent'), async(req, res) => {
    try {
        const { id } = req.params;

        const result = await query(`
            SELECT
                c.*,
                COUNT(ct.id) as contact_count,
                COUNT(call.id) as calls_made
            FROM campaigns c
            LEFT JOIN contacts ct ON c.id = ct.campaign_id
            LEFT JOIN calls call ON c.id = call.campaign_id
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

        // Check if this campaign has an active queue
        const simpleQueue = require('../services/simple-automated-queue');
        const queueStatus = simpleQueue.getQueueStatus(id);
        const isQueueActive = queueStatus && queueStatus.status === 'running';

        res.json({
            success: true,
            campaign: {
                id: campaign.id,
                name: campaign.name,
                type: campaign.type,
                status: campaign.status,
                description: campaign.description || '',
                voicePersona: campaign.voice_persona,
                language: campaign.language,
                accent: campaign.accent,
                autoRetry: campaign.auto_retry,
                bestTimeEnabled: campaign.best_time_enabled,
                emotionDetection: campaign.emotion_detection,
                scriptId: campaign.script_id,
                callSettings: campaign.call_settings || {},
                settings: campaign.settings || {},
                contactCount: parseInt(campaign.contact_count),
                callsMade: parseInt(campaign.calls_made),
                automatedCallsActive: isQueueActive,
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

// Create campaign
router.post('/', authenticateToken, requireRole('admin', 'manager'), async(req, res) => {
    try {
        const { error, value } = createCampaignSchema.validate(req.body);
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
            status,
            description,
            voice_persona,
            language,
            accent,
            auto_retry,
            best_time_enabled,
            emotion_detection,
            script_id,
            callSettings,
            settings
        } = value;

        // Check if campaign name already exists in organization
        const existingCampaign = await query(
            'SELECT id FROM campaigns WHERE name = $1 AND organization_id = $2',
            [name, req.organizationId]
        );

        if (existingCampaign.rows.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Campaign name already exists'
            });
        }

        const result = await query(`
            INSERT INTO campaigns (
                organization_id, name, type, status, description,
                voice_persona, language, accent, auto_retry, best_time_enabled,
                emotion_detection, script_id, call_settings, settings
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            RETURNING *
        `, [
            req.organizationId,
            name,
            type,
            status,
            description,
            voice_persona,
            language,
            accent,
            auto_retry,
            best_time_enabled,
            emotion_detection,
            script_id,
            JSON.stringify(callSettings || {}),
            JSON.stringify(settings || {})
        ]);

        const campaign = result.rows[0];

        logger.info(`Campaign created: ${campaign.id} - ${campaign.name}`);

        res.status(201).json({
            success: true,
            message: 'Campaign created successfully',
            campaign: {
                id: campaign.id,
                name: campaign.name,
                type: campaign.type,
                status: campaign.status,
                description: campaign.description || '',
                voicePersona: campaign.voice_persona,
                language: campaign.language,
                accent: campaign.accent,
                autoRetry: campaign.auto_retry,
                bestTimeEnabled: campaign.best_time_enabled,
                emotionDetection: campaign.emotion_detection,
                scriptId: campaign.script_id,
                callSettings: campaign.call_settings || {},
                settings: campaign.settings || {},
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

// Update campaign
router.put('/:id', authenticateToken, requireRole('admin', 'manager'), async(req, res) => {
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

        // Verify campaign exists and belongs to organization
        const campaignCheck = await query(
            'SELECT id FROM campaigns WHERE id = $1 AND organization_id = $2',
            [id, req.organizationId]
        );

        if (campaignCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Campaign not found'
            });
        }

        // Check if name is being changed and if it already exists
        if (value.name) {
            const existingCampaign = await query(
                'SELECT id FROM campaigns WHERE name = $1 AND organization_id = $2 AND id != $3',
                [value.name, req.organizationId, id]
            );

            if (existingCampaign.rows.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Campaign name already exists'
                });
            }
        }

        // Build update query
        const updates = [];
        const params = [];
        let paramCount = 0;

        // Add field updates
        Object.keys(value).forEach(key => {
            if (value[key] !== undefined) {
                if (key === 'callSettings') {
                    paramCount++;
                    updates.push(`call_settings = $${paramCount}`);
                    params.push(JSON.stringify(value[key]));
                } else {
                    paramCount++;
                    updates.push(`${key} = $${paramCount}`);
                    params.push(value[key]);
                }
            }
        });

        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No fields to update'
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

        logger.info(`Campaign updated: ${campaign.id} - ${campaign.name}`);

        res.json({
            success: true,
            message: 'Campaign updated successfully',
            campaign: {
                id: campaign.id,
                name: campaign.name,
                type: campaign.type,
                status: campaign.status,
                description: campaign.description || '',
                callSettings: campaign.call_settings || {},
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
router.delete('/:id', authenticateToken, requireRole('admin'), async(req, res) => {
    try {
        const { id } = req.params;

        // Verify campaign exists and belongs to organization
        const campaignCheck = await query(
            'SELECT id, name FROM campaigns WHERE id = $1 AND organization_id = $2',
            [id, req.organizationId]
        );

        if (campaignCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Campaign not found'
            });
        }

        // Check if campaign has active calls
        const activeCalls = await query(
            'SELECT COUNT(*) as count FROM calls WHERE campaign_id = $1 AND status IN ($2, $3)',
            [id, 'initiated', 'in_progress']
        );

        if (parseInt(activeCalls.rows[0].count) > 0) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete campaign with active calls'
            });
        }

        // Delete campaign (cascade will handle related records)
        await query('DELETE FROM campaigns WHERE id = $1', [id]);

        logger.info(`Campaign deleted: ${id} - ${campaignCheck.rows[0].name}`);

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

// Get campaign stats
router.get('/:id/stats', authenticateToken, requireRole('admin', 'manager', 'agent'), async(req, res) => {
    try {
        const { id } = req.params;

        // Verify campaign exists and belongs to organization
        const campaignCheck = await query(
            'SELECT id, name FROM campaigns WHERE id = $1 AND organization_id = $2',
            [id, req.organizationId]
        );

        if (campaignCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Campaign not found'
            });
        }

        // Get campaign statistics
        const statsResult = await query(`
            SELECT
                COUNT(DISTINCT ct.id) as total_contacts,
                COUNT(call.id) as total_calls,
                COUNT(CASE WHEN call.status = 'completed' THEN 1 END) as completed_calls,
                COUNT(CASE WHEN call.outcome = 'scheduled' THEN 1 END) as scheduled_calls,
                COUNT(CASE WHEN call.outcome = 'interested' THEN 1 END) as interested_calls,
                COUNT(CASE WHEN call.outcome = 'not_interested' THEN 1 END) as not_interested_calls,
                AVG(call.duration) as avg_duration,
                SUM(call.cost) as total_cost
            FROM campaigns c
            LEFT JOIN contacts ct ON c.id = ct.campaign_id
            LEFT JOIN calls call ON c.id = call.campaign_id
            WHERE c.id = $1
        `, [id]);

        const stats = statsResult.rows[0];

        res.json({
            success: true,
            stats: {
                totalContacts: parseInt(stats.total_contacts),
                totalCalls: parseInt(stats.total_calls),
                completedCalls: parseInt(stats.completed_calls),
                scheduledCalls: parseInt(stats.scheduled_calls),
                interestedCalls: parseInt(stats.interested_calls),
                notInterestedCalls: parseInt(stats.not_interested_calls),
                avgDuration: parseFloat(stats.avg_duration) || 0,
                totalCost: parseFloat(stats.total_cost) || 0
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

module.exports = router;
