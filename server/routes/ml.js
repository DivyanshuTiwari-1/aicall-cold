const express = require('express');
const { query } = require('../config/database');
const logger = require('../utils/logger');

const router = express.Router();

// Get best time prediction for contact
router.get('/best-time/:contact_id', async(req, res) => {
    try {
        const { contact_id } = req.params;

        // Verify contact belongs to organization
        const contactCheck = await query(
            'SELECT id, first_name, last_name, company FROM contacts WHERE id = $1 AND organization_id = $2', [contact_id, req.organizationId]
        );

        if (contactCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Contact not found'
            });
        }

        const contact = contactCheck.rows[0];

        // Get historical call data for this contact
        const callHistory = await query(`
      SELECT 
        EXTRACT(HOUR FROM created_at) as hour,
        EXTRACT(DOW FROM created_at) as day_of_week,
        outcome,
        duration
      FROM calls
      WHERE contact_id = $1 AND status = 'completed'
      ORDER BY created_at DESC
      LIMIT 50
    `, [contact_id]);

        // Simple ML logic (in production, use actual ML models)
        const bestTimes = [];
        const hourStats = {};
        const dayStats = {};

        callHistory.rows.forEach(call => {
            const hour = parseInt(call.hour);
            const day = parseInt(call.day_of_week);
            const isSuccessful = ['scheduled', 'interested'].includes(call.outcome);

            if (!hourStats[hour]) hourStats[hour] = { total: 0, successful: 0 };
            if (!dayStats[day]) dayStats[day] = { total: 0, successful: 0 };

            hourStats[hour].total++;
            dayStats[day].total++;
            if (isSuccessful) {
                hourStats[hour].successful++;
                dayStats[day].successful++;
            }
        });

        // Calculate success rates
        Object.keys(hourStats).forEach(hour => {
            const stats = hourStats[hour];
            const successRate = stats.total > 0 ? (stats.successful / stats.total) : 0;
            bestTimes.push({
                hour: parseInt(hour),
                successRate: parseFloat(successRate.toFixed(2)),
                totalCalls: stats.total,
                successfulCalls: stats.successful
            });
        });

        // Sort by success rate
        bestTimes.sort((a, b) => b.successRate - a.successRate);

        // Get best days
        const bestDays = [];
        Object.keys(dayStats).forEach(day => {
            const stats = dayStats[day];
            const successRate = stats.total > 0 ? (stats.successful / stats.total) : 0;
            bestDays.push({
                day: parseInt(day),
                dayName: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day],
                successRate: parseFloat(successRate.toFixed(2)),
                totalCalls: stats.total,
                successfulCalls: stats.successful
            });
        });

        bestDays.sort((a, b) => b.successRate - a.successRate);

        // Generate recommendations
        const recommendations = [];
        if (bestTimes.length > 0) {
            recommendations.push({
                type: 'time',
                message: `Best time to call: ${bestTimes[0].hour}:00 (${bestTimes[0].successRate * 100}% success rate)`,
                confidence: bestTimes[0].successRate
            });
        }

        if (bestDays.length > 0) {
            recommendations.push({
                type: 'day',
                message: `Best day to call: ${bestDays[0].dayName} (${bestDays[0].successRate * 100}% success rate)`,
                confidence: bestDays[0].successRate
            });
        }

        // Default recommendations if no history
        if (bestTimes.length === 0) {
            recommendations.push({
                type: 'default',
                message: 'No call history available. Try calling between 9 AM - 5 PM on weekdays.',
                confidence: 0.5
            });
        }

        res.json({
            success: true,
            contact: {
                id: contact.id,
                name: `${contact.first_name} ${contact.last_name}`,
                company: contact.company
            },
            predictions: {
                bestTimes: bestTimes.slice(0, 5),
                bestDays: bestDays.slice(0, 3),
                recommendations,
                totalCalls: callHistory.rows.length,
                lastCallDate: callHistory.rows.length > 0 ? callHistory.rows[0].created_at : null
            }
        });

    } catch (error) {
        logger.error('Best time prediction error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to predict best time'
        });
    }
});

// Get script optimization recommendations
router.get('/optimize-script/:script_id', async(req, res) => {
    try {
        const { script_id } = req.params;

        // Verify script belongs to organization
        const scriptCheck = await query(
            'SELECT id, name, content, type FROM scripts WHERE id = $1 AND organization_id = $2', [script_id, req.organizationId]
        );

        if (scriptCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Script not found'
            });
        }

        const script = scriptCheck.rows[0];

        // Get performance data for this script
        const performanceData = await query(`
      SELECT 
        cl.outcome,
        cl.duration,
        cl.emotion,
        cl.intent_score,
        cl.csat_score,
        cl.created_at
      FROM calls cl
      JOIN campaigns cp ON cl.campaign_id = cp.id
      WHERE cp.script_id = $1 AND cl.status = 'completed'
      ORDER BY cl.created_at DESC
      LIMIT 100
    `, [script_id]);

        // Analyze performance
        const outcomes = {};
        const emotions = {};
        const durations = [];
        const intentScores = [];
        const csatScores = [];

        performanceData.rows.forEach(call => {
            // Count outcomes
            outcomes[call.outcome] = (outcomes[call.outcome] || 0) + 1;

            // Count emotions
            if (call.emotion) {
                emotions[call.emotion] = (emotions[call.emotion] || 0) + 1;
            }

            // Collect metrics
            if (call.duration) durations.push(call.duration);
            if (call.intent_score) intentScores.push(call.intent_score);
            if (call.csat_score) csatScores.push(call.csat_score);
        });

        // Calculate averages
        const avgDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
        const avgIntentScore = intentScores.length > 0 ? intentScores.reduce((a, b) => a + b, 0) / intentScores.length : 0;
        const avgCsatScore = csatScores.length > 0 ? csatScores.reduce((a, b) => a + b, 0) / csatScores.length : 0;

        // Calculate conversion rate
        const totalCalls = performanceData.rows.length;
        const successfulCalls = (outcomes.scheduled || 0) + (outcomes.interested || 0);
        const conversionRate = totalCalls > 0 ? (successfulCalls / totalCalls) : 0;

        // Generate recommendations
        const recommendations = [];

        if (conversionRate < 0.2) {
            recommendations.push({
                type: 'conversion',
                priority: 'high',
                message: 'Low conversion rate detected. Consider revising the opening and value proposition.',
                currentValue: `${(conversionRate * 100).toFixed(1)}%`,
                targetValue: '30%+'
            });
        }

        if (avgDuration < 60) {
            recommendations.push({
                type: 'duration',
                priority: 'medium',
                message: 'Calls are ending too quickly. Add more engaging questions to extend conversations.',
                currentValue: `${avgDuration.toFixed(0)}s`,
                targetValue: '120s+'
            });
        }

        if (avgIntentScore < 0.6) {
            recommendations.push({
                type: 'intent',
                priority: 'high',
                message: 'Low intent scores suggest prospects aren\'t engaged. Add more qualifying questions.',
                currentValue: avgIntentScore.toFixed(2),
                targetValue: '0.7+'
            });
        }

        if (avgCsatScore < 3.5) {
            recommendations.push({
                type: 'satisfaction',
                priority: 'medium',
                message: 'Customer satisfaction is low. Review objection handling and tone.',
                currentValue: avgCsatScore.toFixed(1),
                targetValue: '4.0+'
            });
        }

        // Analyze emotions
        const dominantEmotion = Object.keys(emotions).reduce((a, b) => emotions[a] > emotions[b] ? a : b, 'neutral');
        if (dominantEmotion === 'frustrated' || dominantEmotion === 'angry') {
            recommendations.push({
                type: 'emotion',
                priority: 'high',
                message: 'High negative emotions detected. Review script tone and approach.',
                currentValue: dominantEmotion,
                targetValue: 'neutral/positive'
            });
        }

        res.json({
            success: true,
            script: {
                id: script.id,
                name: script.name,
                type: script.type
            },
            performance: {
                totalCalls,
                conversionRate: parseFloat(conversionRate.toFixed(3)),
                avgDuration: parseFloat(avgDuration.toFixed(1)),
                avgIntentScore: parseFloat(avgIntentScore.toFixed(2)),
                avgCsatScore: parseFloat(avgCsatScore.toFixed(1)),
                outcomes,
                emotions,
                dominantEmotion
            },
            recommendations,
            lastAnalyzed: new Date().toISOString()
        });

    } catch (error) {
        logger.error('Script optimization error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to analyze script performance'
        });
    }
});

module.exports = router;