const express = require('express');
const Joi = require('joi');
const { query } = require('../config/database');
const logger = require('../utils/logger');

const router = express.Router();

// Cost optimization configuration
const COST_CONFIG = {
    // Target: $0.00045 per 5-minute call
    targetCostPerCall: 0.00045,
    targetCallDuration: 300, // 5 minutes in seconds

    // Service costs per minute
    telnyxCostPerMinute: 0.0045,
    ttsCostPerMinute: 0.0000, // eSpeak is free
    aiCostPerMinute: 0.0000, // Local processing is free

    // Optimization strategies
    strategies: {
        callDurationOptimization: true,
        ttsOptimization: true,
        aiOptimization: true,
        batchProcessing: true,
        caching: true
    }
};

// Validation schemas
const costAnalysisSchema = Joi.object({
    timeRange: Joi.string().valid('24h', '7d', '30d', '90d').default('7d'),
    includeBreakdown: Joi.boolean().default(true)
});

const optimizationSettingsSchema = Joi.object({
    maxCallDuration: Joi.number().min(60).max(600).default(300),
    ttsEngine: Joi.string().valid('espeak', 'google', 'azure', 'aws').default('espeak'),
    aiProcessingMode: Joi.string().valid('local', 'cloud', 'hybrid').default('local'),
    batchSize: Joi.number().min(1).max(100).default(10),
    enableCaching: Joi.boolean().default(true)
});

// Get cost analysis
router.get('/analysis', async(req, res) => {
    try {
        const { error, value } = costAnalysisSchema.validate(req.query);
        if (error) {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: error.details.map(d => d.message)
            });
        }

        const { timeRange, includeBreakdown } = value;

        let dateFilter = '';
        switch (timeRange) {
            case '24h':
                dateFilter = "AND created_at >= CURRENT_DATE";
                break;
            case '7d':
                dateFilter = "AND created_at >= CURRENT_DATE - INTERVAL '7 days'";
                break;
            case '30d':
                dateFilter = "AND created_at >= CURRENT_DATE - INTERVAL '30 days'";
                break;
            case '90d':
                dateFilter = "AND created_at >= CURRENT_DATE - INTERVAL '90 days'";
                break;
        }

        // Get call statistics
        const callStats = await query(`
            SELECT
                COUNT(*) as total_calls,
                AVG(duration) as avg_duration,
                SUM(duration) as total_duration,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_calls,
                COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_calls
            FROM calls
            WHERE organization_id = $1 ${dateFilter}
        `, [req.organizationId]);

        const stats = callStats.rows[0];
        const totalCalls = parseInt(stats.total_calls) || 0;
        const avgDuration = parseFloat(stats.avg_duration) || 0;
        const totalDuration = parseFloat(stats.total_duration) || 0;
        const completedCalls = parseInt(stats.completed_calls) || 0;
        const failedCalls = parseInt(stats.failed_calls) || 0;

        // Calculate costs
        const telnyxCost = (totalDuration / 60) * COST_CONFIG.telnyxCostPerMinute;
        const ttsCost = 0; // eSpeak is free
        const aiCost = 0; // Local processing is free
        const totalCost = telnyxCost + ttsCost + aiCost;

        const costPerCall = totalCalls > 0 ? totalCost / totalCalls : 0;
        const targetCost = COST_CONFIG.targetCostPerCall;
        const costSavings = Math.max(0, costPerCall - targetCost);
        const costEfficiency = targetCost > 0 ? Math.round((targetCost / costPerCall) * 100) : 0;

        // Calculate optimization potential
        const optimizationPotential = calculateOptimizationPotential(avgDuration, costPerCall);

        const analysis = {
            summary: {
                totalCalls,
                completedCalls,
                failedCalls,
                avgDuration: Math.round(avgDuration),
                totalDuration: Math.round(totalDuration),
                costPerCall: Math.round(costPerCall * 10000) / 10000, // Round to 4 decimal places
                targetCost,
                costSavings: Math.round(costSavings * 10000) / 10000,
                costEfficiency,
                isTargetMet: costPerCall <= targetCost
            },
            breakdown: includeBreakdown ? {
                telnyx: {
                    cost: Math.round(telnyxCost * 10000) / 10000,
                    percentage: totalCost > 0 ? Math.round((telnyxCost / totalCost) * 100) : 0,
                    costPerMinute: COST_CONFIG.telnyxCostPerMinute
                },
                tts: {
                    cost: 0,
                    percentage: 0,
                    costPerMinute: 0
                },
                ai: {
                    cost: 0,
                    percentage: 0,
                    costPerMinute: 0
                },
                total: Math.round(totalCost * 10000) / 10000
            } : null,
            optimization: optimizationPotential
        };

        res.json({
            success: true,
            analysis
        });

    } catch (error) {
        logger.error('Cost analysis error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate cost analysis'
        });
    }
});

// Get optimization recommendations
router.get('/recommendations', async(req, res) => {
    try {
        const { timeRange = '7d' } = req.query;

        let dateFilter = '';
        switch (timeRange) {
            case '24h':
                dateFilter = "AND created_at >= CURRENT_DATE";
                break;
            case '7d':
                dateFilter = "AND created_at >= CURRENT_DATE - INTERVAL '7 days'";
                break;
            case '30d':
                dateFilter = "AND created_at >= CURRENT_DATE - INTERVAL '30 days'";
                break;
            case '90d':
                dateFilter = "AND created_at >= CURRENT_DATE - INTERVAL '90 days'";
                break;
        }

        // Get current performance metrics
        const metrics = await query(`
            SELECT
                AVG(duration) as avg_duration,
                COUNT(*) as total_calls,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_calls,
                AVG(CASE WHEN status = 'completed' THEN duration END) as avg_completed_duration
            FROM calls
            WHERE organization_id = $1 ${dateFilter}
        `, [req.organizationId]);

        const avgDuration = parseFloat(metrics.rows[0].avg_duration) || 0;
        const totalCalls = parseInt(metrics.rows[0].total_calls) || 0;
        const completedCalls = parseInt(metrics.rows[0].completed_calls) || 0;
        const avgCompletedDuration = parseFloat(metrics.rows[0].avg_completed_duration) || 0;

        const currentCostPerCall = (avgDuration / 60) * COST_CONFIG.telnyxCostPerMinute;
        const targetCost = COST_CONFIG.targetCostPerCall;

        const recommendations = [];

        // Duration optimization
        if (avgDuration > COST_CONFIG.targetCallDuration) {
            const potentialSavings = ((avgDuration - COST_CONFIG.targetCallDuration) / 60) * COST_CONFIG.telnyxCostPerMinute;
            recommendations.push({
                type: 'duration_optimization',
                priority: 'high',
                title: 'Optimize Call Duration',
                description: `Reduce average call duration from ${Math.round(avgDuration)}s to ${COST_CONFIG.targetCallDuration}s`,
                potentialSavings: Math.round(potentialSavings * 10000) / 10000,
                impact: 'high',
                effort: 'medium',
                actions: [
                    'Implement smarter conversation flow',
                    'Add early exit conditions',
                    'Optimize script length',
                    'Use more efficient TTS settings'
                ]
            });
        }

        // TTS optimization
        recommendations.push({
            type: 'tts_optimization',
            priority: 'medium',
            title: 'Optimize TTS Settings',
            description: 'Fine-tune eSpeak settings for better performance',
            potentialSavings: 0.0001, // Minimal but measurable
            impact: 'low',
            effort: 'low',
            actions: [
                'Adjust speech rate for faster delivery',
                'Optimize voice selection',
                'Implement TTS caching',
                'Use shorter, more concise scripts'
            ]
        });

        // AI optimization
        recommendations.push({
            type: 'ai_optimization',
            priority: 'medium',
            title: 'Optimize AI Processing',
            description: 'Improve local AI processing efficiency',
            potentialSavings: 0.00005,
            impact: 'low',
            effort: 'medium',
            actions: [
                'Implement response caching',
                'Optimize conversation patterns',
                'Use pre-computed responses',
                'Reduce API call frequency'
            ]
        });

        // Batch processing
        if (totalCalls > 10) {
            recommendations.push({
                type: 'batch_processing',
                priority: 'low',
                title: 'Implement Batch Processing',
                description: 'Process multiple calls in batches for efficiency',
                potentialSavings: 0.00002,
                impact: 'low',
                effort: 'high',
                actions: [
                    'Implement call queuing',
                    'Batch TTS generation',
                    'Optimize database queries',
                    'Use connection pooling'
                ]
            });
        }

        // Calculate total potential savings
        const totalPotentialSavings = recommendations.reduce((sum, rec) => sum + rec.potentialSavings, 0);
        const newCostPerCall = Math.max(0, currentCostPerCall - totalPotentialSavings);

        res.json({
            success: true,
            recommendations,
            summary: {
                currentCostPerCall: Math.round(currentCostPerCall * 10000) / 10000,
                targetCost,
                totalPotentialSavings: Math.round(totalPotentialSavings * 10000) / 10000,
                projectedCostPerCall: Math.round(newCostPerCall * 10000) / 10000,
                targetAchievable: newCostPerCall <= targetCost
            }
        });

    } catch (error) {
        logger.error('Cost recommendations error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate cost recommendations'
        });
    }
});

// Update optimization settings
router.put('/settings', async(req, res) => {
    try {
        const { error, value } = optimizationSettingsSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: error.details.map(d => d.message)
            });
        }

        // Update optimization settings in database
        await query(`
            INSERT INTO cost_optimization_settings (organization_id, settings, updated_by)
            VALUES ($1, $2, $3)
            ON CONFLICT (organization_id)
            DO UPDATE SET
                settings = $2,
                updated_by = $3,
                updated_at = CURRENT_TIMESTAMP
        `, [req.organizationId, JSON.stringify(value), req.user.id]);

        // Log audit event
        await query(`
            INSERT INTO compliance_audit_logs (organization_id, event_type, event_data, user_id)
            VALUES ($1, $2, $3, $4)
        `, [
            req.organizationId,
            'cost_settings_updated',
            JSON.stringify({
                settings: value,
                updated_by: req.user.id
            }),
            req.user.id
        ]);

        logger.info(`Cost optimization settings updated by user ${req.user.id}`);

        res.json({
            success: true,
            message: 'Cost optimization settings updated successfully',
            settings: value
        });

    } catch (error) {
        logger.error('Cost settings update error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update cost optimization settings'
        });
    }
});

// Get optimization settings
router.get('/settings', async(req, res) => {
    try {
        const result = await query(`
            SELECT settings
            FROM cost_optimization_settings
            WHERE organization_id = $1
        `, [req.organizationId]);

        if (result.rows.length > 0) {
            res.json({
                success: true,
                settings: result.rows[0].settings
            });
        } else {
            // Return default settings
            const defaultSettings = {
                maxCallDuration: 300,
                ttsEngine: 'espeak',
                aiProcessingMode: 'local',
                batchSize: 10,
                enableCaching: true
            };

            res.json({
                success: true,
                settings: defaultSettings
            });
        }

    } catch (error) {
        logger.error('Cost settings fetch error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch cost optimization settings'
        });
    }
});

// Helper function to calculate optimization potential
function calculateOptimizationPotential(avgDuration, currentCost) {
    const targetDuration = COST_CONFIG.targetCallDuration;
    const targetCost = COST_CONFIG.targetCostPerCall;

    const durationOptimization = Math.max(0, avgDuration - targetDuration);
    const costOptimization = Math.max(0, currentCost - targetCost);

    return {
        durationOptimization: {
            current: Math.round(avgDuration),
            target: targetDuration,
            potential: Math.round(durationOptimization),
            percentage: avgDuration > 0 ? Math.round((durationOptimization / avgDuration) * 100) : 0
        },
        costOptimization: {
            current: Math.round(currentCost * 10000) / 10000,
            target: targetCost,
            potential: Math.round(costOptimization * 10000) / 10000,
            percentage: currentCost > 0 ? Math.round((costOptimization / currentCost) * 100) : 0
        },
        overallPotential: {
            achievable: currentCost > targetCost,
            effort: durationOptimization > 60 ? 'high' : durationOptimization > 30 ? 'medium' : 'low',
            impact: costOptimization > 0.001 ? 'high' : costOptimization > 0.0005 ? 'medium' : 'low'
        }
    };
}

module.exports = router;