const express = require('express');
const Joi = require('joi');
const { query } = require('../config/database');
const logger = require('../utils/logger');
const { authenticateToken, requireRole } = require('../middleware/auth');
const {
    analyzeCallTranscript,
    detectIntent,
    analyzeEmotions,
    generateAutoTags,
    detectObjections,
    generateEmotionTimeline,
    calculateAgentEmpathyScore,
    generateEmotionHeatmapData,
    calculateEmotionVolatility
} = require('../services/ai-analysis');

const router = express.Router();

// Validation schemas
const analyzeCallSchema = Joi.object({
    callId: Joi.string().uuid().required(),
    transcript: Joi.string().optional(),
    audioUrl: Joi.string().uri().optional()
});

const addTagSchema = Joi.object({
    tag: Joi.string().max(100).required(),
    tagType: Joi.string().valid('auto', 'manual').default('manual'),
    confidence: Joi.number().min(0).max(1).optional()
});

// Analyze call transcript for intent and emotions
router.post('/analyze-call', authenticateToken, requireRole('admin', 'manager', 'agent'), async(req, res) => {
    try {
        const { error, value } = analyzeCallSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: error.details
            });
        }

        const { callId, transcript, audioUrl } = value;

        // Get call details
        const callResult = await query(`
            SELECT c.*, cont.first_name, cont.last_name, cont.phone
            FROM calls c
            JOIN contacts cont ON c.contact_id = cont.id
            WHERE c.id = $1 AND c.organization_id = $2
        `, [callId, req.user.organizationId]);

        if (callResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Call not found'
            });
        }

        const call = callResult.rows[0];

        // If no transcript provided, try to get it from the call
        let finalTranscript = transcript;
        if (!finalTranscript && call.transcript) {
            finalTranscript = call.transcript;
        }

        if (!finalTranscript) {
            return res.status(400).json({
                success: false,
                message: 'No transcript available for analysis'
            });
        }

        // Perform AI analysis
        const analysis = await analyzeCallTranscript(callId, finalTranscript);

        // Store analysis results
        await query(`
            INSERT INTO call_analysis (
                call_id, intent_label, intent_confidence,
                emotion_dominant, emotion_intensity, emotion_volatility,
                emotion_timeline
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (call_id) DO UPDATE SET
                intent_label = EXCLUDED.intent_label,
                intent_confidence = EXCLUDED.intent_confidence,
                emotion_dominant = EXCLUDED.emotion_dominant,
                emotion_intensity = EXCLUDED.emotion_intensity,
                emotion_volatility = EXCLUDED.emotion_volatility,
                emotion_timeline = EXCLUDED.emotion_timeline,
                updated_at = CURRENT_TIMESTAMP
        `, [
            callId,
            analysis.intent.label,
            analysis.intent.confidence,
            analysis.emotion.dominant,
            analysis.emotion.intensity,
            analysis.emotion.volatility,
            JSON.stringify(analysis.emotion.timeline)
        ]);

        // Store auto-generated tags
        if (analysis.autoTags && analysis.autoTags.length > 0) {
            for (const tag of analysis.autoTags) {
                await query(`
                    INSERT INTO call_tags (call_id, tag, tag_type, confidence)
                    VALUES ($1, $2, 'auto', $3)
                    ON CONFLICT (call_id, tag) DO NOTHING
                `, [callId, tag.name, tag.confidence]);
            }
        }

        // Store detected objections
        if (analysis.objections && analysis.objections.length > 0) {
            for (const objection of analysis.objections) {
                await query(`
                    INSERT INTO call_objections (call_id, objection_type, severity, timestamp_seconds)
                    VALUES ($1, $2, $3, $4)
                `, [callId, objection.type, objection.severity, objection.timestamp]);
            }
        }

        // Broadcast analysis completion
        if (global.broadcastAnalysisComplete) {
            global.broadcastAnalysisComplete(callId, analysis);
        }

        res.json({
            success: true,
            analysis: {
                intent: analysis.intent,
                emotion: analysis.emotion,
                autoTags: analysis.autoTags,
                objections: analysis.objections,
                highlights: analysis.highlights
            }
        });

    } catch (error) {
        logger.error('Call analysis error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to analyze call'
        });
    }
});

// Get call analysis results
router.get('/calls/:callId/analysis', authenticateToken, requireRole('admin', 'manager', 'agent'), async(req, res) => {
    try {
        const { callId } = req.params;

        // Get analysis results
        const analysisResult = await query(`
            SELECT ca.*, c.transcript, c.outcome, c.duration
            FROM call_analysis ca
            JOIN calls c ON ca.call_id = c.id
            WHERE ca.call_id = $1 AND c.organization_id = $2
        `, [callId, req.user.organizationId]);

        if (analysisResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Analysis not found'
            });
        }

        const analysis = analysisResult.rows[0];

        // Get tags
        const tagsResult = await query(`
            SELECT ct.*, u.first_name, u.last_name
            FROM call_tags ct
            LEFT JOIN users u ON ct.added_by = u.id
            WHERE ct.call_id = $1
            ORDER BY ct.created_at DESC
        `, [callId]);

        // Get objections
        const objectionsResult = await query(`
            SELECT * FROM call_objections
            WHERE call_id = $1
            ORDER BY timestamp_seconds ASC
        `, [callId]);

        // Get highlights
        const highlightsResult = await query(`
            SELECT ch.*, u.first_name, u.last_name
            FROM call_highlights ch
            LEFT JOIN users u ON ch.created_by = u.id
            WHERE ch.call_id = $1
            ORDER BY ch.timestamp_seconds ASC
        `, [callId]);

        res.json({
            success: true,
            analysis: {
                ...analysis,
                tags: tagsResult.rows,
                objections: objectionsResult.rows,
                highlights: highlightsResult.rows
            }
        });

    } catch (error) {
        logger.error('Get analysis error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get analysis'
        });
    }
});

// Add manual tag to call
router.post('/calls/:callId/tags', authenticateToken, requireRole('admin', 'manager', 'agent'), async(req, res) => {
    try {
        const { callId } = req.params;
        const { error, value } = addTagSchema.validate(req.body);

        if (error) {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: error.details
            });
        }

        const { tag, tagType, confidence } = value;

        // Verify call exists and user has access
        const callResult = await query(`
            SELECT id FROM calls
            WHERE id = $1 AND organization_id = $2
        `, [callId, req.user.organizationId]);

        if (callResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Call not found'
            });
        }

        // Add tag
        await query(`
            INSERT INTO call_tags (call_id, tag, tag_type, added_by, confidence)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (call_id, tag) DO UPDATE SET
                tag_type = EXCLUDED.tag_type,
                added_by = EXCLUDED.added_by,
                confidence = EXCLUDED.confidence,
                updated_at = CURRENT_TIMESTAMP
        `, [callId, tag, tagType, req.user.id, confidence]);

        res.json({
            success: true,
            message: 'Tag added successfully'
        });

    } catch (error) {
        logger.error('Add tag error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to add tag'
        });
    }
});

// Get all tags for a call
router.get('/calls/:callId/tags', authenticateToken, requireRole('admin', 'manager', 'agent'), async(req, res) => {
    try {
        const { callId } = req.params;

        const result = await query(`
            SELECT ct.*, u.first_name, u.last_name
            FROM call_tags ct
            LEFT JOIN users u ON ct.added_by = u.id
            JOIN calls c ON ct.call_id = c.id
            WHERE ct.call_id = $1 AND c.organization_id = $2
            ORDER BY ct.created_at DESC
        `, [callId, req.user.organizationId]);

        res.json({
            success: true,
            tags: result.rows
        });

    } catch (error) {
        logger.error('Get tags error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get tags'
        });
    }
});

// Add call highlight
router.post('/calls/:callId/highlights', authenticateToken, requireRole('admin', 'manager', 'agent'), async(req, res) => {
    try {
        const { callId } = req.params;
        const { timestampSeconds, highlightType, description } = req.body;

        if (!timestampSeconds || !highlightType) {
            return res.status(400).json({
                success: false,
                message: 'Timestamp and highlight type are required'
            });
        }

        // Verify call exists
        const callResult = await query(`
            SELECT id FROM calls
            WHERE id = $1 AND organization_id = $2
        `, [callId, req.user.organizationId]);

        if (callResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Call not found'
            });
        }

        // Add highlight
        await query(`
            INSERT INTO call_highlights (call_id, timestamp_seconds, highlight_type, description, created_by)
            VALUES ($1, $2, $3, $4, $5)
        `, [callId, timestampSeconds, highlightType, description, req.user.id]);

        res.json({
            success: true,
            message: 'Highlight added successfully'
        });

    } catch (error) {
        logger.error('Add highlight error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to add highlight'
        });
    }
});

// Get emotion analytics for organization
router.get('/emotion-analytics', authenticateToken, requireRole('admin', 'manager', 'agent'), async(req, res) => {
    try {
        const { period = '7d', startDate, endDate } = req.query;

        // Calculate date range
        let dateFilter = '';
        let params = [req.user.organizationId];

        if (startDate && endDate) {
            dateFilter = 'AND c.created_at BETWEEN $2 AND $3';
            params.push(startDate, endDate);
        } else {
            const days = period === '1d' ? 1 : period === '7d' ? 7 : period === '30d' ? 30 : 7;
            dateFilter = `AND c.created_at >= NOW() - INTERVAL '${days} days'`;
        }

        // Get emotion analytics
        const emotionResult = await query(`
            SELECT
                ca.emotion_dominant,
                COUNT(*) as emotion_count,
                AVG(ca.emotion_intensity) as avg_intensity,
                AVG(ca.emotion_volatility) as avg_volatility,
                COUNT(CASE WHEN c.outcome = 'scheduled' THEN 1 END) as conversions,
                COUNT(CASE WHEN c.outcome = 'interested' THEN 1 END) as interested_calls
            FROM call_analysis ca
            JOIN calls c ON ca.call_id = c.id
            WHERE c.organization_id = $1 ${dateFilter}
            GROUP BY ca.emotion_dominant
            ORDER BY emotion_count DESC
        `, params);

        // Get intent analytics
        const intentResult = await query(`
            SELECT
                ca.intent_label,
                COUNT(*) as intent_count,
                AVG(ca.intent_confidence) as avg_confidence,
                COUNT(CASE WHEN c.outcome = 'scheduled' THEN 1 END) as conversions
            FROM call_analysis ca
            JOIN calls c ON ca.call_id = c.id
            WHERE c.organization_id = $1 ${dateFilter}
            GROUP BY ca.intent_label
            ORDER BY intent_count DESC
        `, params);

        res.json({
            success: true,
            analytics: {
                emotions: emotionResult.rows,
                intents: intentResult.rows,
                period
            }
        });

    } catch (error) {
        logger.error('Emotion analytics error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get emotion analytics'
        });
    }
});

// Get emotion heatmap data
router.get('/emotion-heatmap', authenticateToken, requireRole('admin', 'manager', 'agent'), async(req, res) => {
    try {
        const { startDate, endDate } = req.query;

        const heatmapData = await generateEmotionHeatmapData(
            req.user.organizationId,
            startDate,
            endDate
        );

        res.json({
            success: true,
            heatmapData
        });

    } catch (error) {
        logger.error('Emotion heatmap error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get emotion heatmap data'
        });
    }
});

// Get emotion journey for a specific call
router.get('/emotion-journey/:callId', authenticateToken, requireRole('admin', 'manager', 'agent'), async(req, res) => {
    try {
        const { callId } = req.params;

        // Verify call exists and user has access
        const callResult = await query(`
            SELECT c.id, c.transcript, c.organization_id
            FROM calls c
            WHERE c.id = $1 AND c.organization_id = $2
        `, [callId, req.user.organizationId]);

        if (callResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Call not found'
            });
        }

        const call = callResult.rows[0];

        if (!call.transcript) {
            return res.status(400).json({
                success: false,
                message: 'No transcript available for emotion journey'
            });
        }

        // Get detailed emotion turns from database
        const turnsResult = await query(`
            SELECT turn_number, speaker, emotion, intensity, confidence, timestamp_seconds, text_snippet
            FROM emotion_turns
            WHERE call_id = $1
            ORDER BY turn_number ASC
        `, [callId]);

        const emotionJourney = turnsResult.rows.map(turn => ({
            turnNumber: turn.turn_number,
            speaker: turn.speaker,
            emotion: turn.emotion,
            intensity: parseFloat(turn.intensity),
            confidence: parseFloat(turn.confidence),
            timestamp: turn.timestamp_seconds,
            textSnippet: turn.text_snippet
        }));

        res.json({
            success: true,
            emotionJourney
        });

    } catch (error) {
        logger.error('Emotion journey error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get emotion journey'
        });
    }
});

// Get agent empathy score
router.get('/agent-empathy-score/:agentId', authenticateToken, requireRole('admin', 'manager'), async(req, res) => {
    try {
        const { agentId } = req.params;
        const { period = '30d' } = req.query;

        // Calculate date range
        const days = period === '1d' ? 1 : period === '7d' ? 7 : period === '30d' ? 30 : 30;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        // Get agent empathy scores
        const empathyResult = await query(`
            SELECT
                aes.empathy_score,
                aes.emotion_improvement,
                aes.initial_emotion,
                aes.final_emotion,
                aes.calculated_at,
                c.created_at as call_date
            FROM agent_empathy_scores aes
            JOIN calls c ON aes.call_id = c.id
            WHERE aes.agent_id = $1
            AND c.organization_id = $2
            AND c.created_at >= $3
            ORDER BY c.created_at DESC
        `, [agentId, req.user.organizationId, startDate]);

        if (empathyResult.rows.length === 0) {
            return res.json({
                success: true,
                empathyScore: {
                    averageScore: 0.5,
                    totalCalls: 0,
                    improvementRate: 0,
                    scores: []
                }
            });
        }

        const scores = empathyResult.rows;
        const averageScore = scores.reduce((sum, score) => sum + parseFloat(score.empathy_score), 0) / scores.length;
        const improvementRate = scores.filter(score => score.emotion_improvement).length / scores.length;

        res.json({
            success: true,
            empathyScore: {
                averageScore: parseFloat(averageScore.toFixed(3)),
                totalCalls: scores.length,
                improvementRate: parseFloat(improvementRate.toFixed(3)),
                scores: scores.map(score => ({
                    empathyScore: parseFloat(score.empathy_score),
                    emotionImprovement: score.emotion_improvement,
                    initialEmotion: score.initial_emotion,
                    finalEmotion: score.final_emotion,
                    calculatedAt: score.calculated_at,
                    callDate: score.call_date
                }))
            }
        });

    } catch (error) {
        logger.error('Agent empathy score error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get agent empathy score'
        });
    }
});

// Enhanced emotion analytics with volatility trends
router.get('/emotion-analytics-enhanced', authenticateToken, requireRole('admin', 'manager', 'agent'), async(req, res) => {
    try {
        const { period = '7d', startDate, endDate } = req.query;

        // Calculate date range
        let dateFilter = '';
        let params = [req.user.organizationId];

        if (startDate && endDate) {
            dateFilter = 'AND c.created_at BETWEEN $2 AND $3';
            params.push(startDate, endDate);
        } else {
            const days = period === '1d' ? 1 : period === '7d' ? 7 : period === '30d' ? 30 : 7;
            dateFilter = `AND c.created_at >= NOW() - INTERVAL '${days} days'`;
        }

        // Get enhanced emotion analytics with volatility trends
        const emotionResult = await query(`
            SELECT
                ca.emotion_dominant,
                COUNT(*) as emotion_count,
                AVG(ca.emotion_intensity) as avg_intensity,
                AVG(ca.emotion_volatility) as avg_volatility,
                COUNT(CASE WHEN c.outcome = 'scheduled' THEN 1 END) as conversions,
                COUNT(CASE WHEN c.outcome = 'interested' THEN 1 END) as interested_calls,
                COUNT(CASE WHEN ca.emotion_volatility > 0.7 THEN 1 END) as high_volatility_calls
            FROM call_analysis ca
            JOIN calls c ON ca.call_id = c.id
            WHERE c.organization_id = $1 ${dateFilter}
            GROUP BY ca.emotion_dominant
            ORDER BY emotion_count DESC
        `, params);

        // Get volatility trends over time
        const volatilityTrendResult = await query(`
            SELECT
                DATE(c.created_at) as date,
                AVG(ca.emotion_volatility) as avg_volatility,
                COUNT(*) as call_count
            FROM call_analysis ca
            JOIN calls c ON ca.call_id = c.id
            WHERE c.organization_id = $1 ${dateFilter}
            GROUP BY DATE(c.created_at)
            ORDER BY date ASC
        `, params);

        // Get conversion correlation by emotion
        const conversionResult = await query(`
            SELECT
                ca.emotion_dominant,
                COUNT(*) as total_calls,
                COUNT(CASE WHEN c.outcome = 'scheduled' THEN 1 END) as conversions,
                ROUND(
                    COUNT(CASE WHEN c.outcome = 'scheduled' THEN 1 END)::DECIMAL / COUNT(*) * 100, 2
                ) as conversion_rate
            FROM call_analysis ca
            JOIN calls c ON ca.call_id = c.id
            WHERE c.organization_id = $1 ${dateFilter}
            GROUP BY ca.emotion_dominant
            ORDER BY conversion_rate DESC
        `, params);

        res.json({
            success: true,
            analytics: {
                emotions: emotionResult.rows,
                volatilityTrends: volatilityTrendResult.rows,
                conversionCorrelation: conversionResult.rows,
                period
            }
        });

    } catch (error) {
        logger.error('Enhanced emotion analytics error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get enhanced emotion analytics'
        });
    }
});

module.exports = router;
