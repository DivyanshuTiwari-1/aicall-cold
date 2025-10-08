const express = require('express');
const { query } = require('../config/database');
const logger = require('../utils/logger');

const router = express.Router();

// Get dashboard analytics
router.get('/dashboard', async(req, res) => {
    try {
        const { start_date, end_date } = req.query;

        let dateFilter = '';
        const params = [req.organizationId];
        let paramCount = 1;

        if (start_date && end_date) {
            paramCount++;
            dateFilter = `AND c.created_at BETWEEN $${paramCount} AND $${paramCount + 1}`;
            params.push(start_date, end_date);
        }

        // Get overall stats
        const statsResult = await query(`
      SELECT
        COUNT(DISTINCT c.id) as total_campaigns,
        COUNT(DISTINCT ct.id) as total_contacts,
        COUNT(cl.id) as total_calls,
        COUNT(CASE WHEN cl.status = 'completed' THEN 1 END) as completed_calls,
        COUNT(CASE WHEN cl.outcome = 'scheduled' THEN 1 END) as scheduled_calls,
        COUNT(CASE WHEN cl.outcome = 'interested' THEN 1 END) as interested_calls,
        COALESCE(SUM(cl.cost), 0) as total_cost,
        COALESCE(AVG(cl.duration), 0) as avg_duration
      FROM campaigns c
      LEFT JOIN contacts ct ON c.id = ct.campaign_id
      LEFT JOIN calls cl ON ct.id = cl.contact_id ${dateFilter}
      WHERE c.organization_id = $1
    `, params);

        const stats = statsResult.rows[0];

        // Get conversion rates
        const conversionRate = stats.total_calls > 0 ?
            ((parseInt(stats.scheduled_calls) + parseInt(stats.interested_calls)) / parseInt(stats.total_calls) * 100).toFixed(2) :
            0;

        // Get recent calls
        const recentCallsResult = await query(`
      SELECT
        cl.id,
        cl.status,
        cl.outcome,
        cl.duration,
        cl.emotion,
        cl.intent_score,
        cl.created_at,
        ct.first_name,
        ct.last_name,
        ct.company,
        cp.name as campaign_name
      FROM calls cl
      JOIN contacts ct ON cl.contact_id = ct.id
      JOIN campaigns cp ON cl.campaign_id = cp.id
      WHERE cl.organization_id = $1 ${dateFilter}
      ORDER BY cl.created_at DESC
      LIMIT 10
    `, params);

        const recentCalls = recentCallsResult.rows.map(call => ({
            id: call.id,
            status: call.status,
            outcome: call.outcome,
            duration: call.duration,
            emotion: call.emotion,
            intentScore: call.intent_score,
            contactName: `${call.first_name} ${call.last_name}`,
            company: call.company,
            campaignName: call.campaign_name,
            createdAt: call.created_at
        }));

        // Get campaign performance
        const campaignStatsResult = await query(`
      SELECT
        cp.id,
        cp.name,
        COUNT(cl.id) as total_calls,
        COUNT(CASE WHEN cl.status = 'completed' THEN 1 END) as completed_calls,
        COUNT(CASE WHEN cl.outcome = 'scheduled' THEN 1 END) as scheduled_calls,
        COUNT(CASE WHEN cl.outcome = 'interested' THEN 1 END) as interested_calls,
        COALESCE(AVG(cl.duration), 0) as avg_duration,
        COALESCE(SUM(cl.cost), 0) as total_cost
      FROM campaigns cp
      LEFT JOIN calls cl ON cp.id = cl.campaign_id ${dateFilter}
      WHERE cp.organization_id = $1
      GROUP BY cp.id, cp.name
      ORDER BY total_calls DESC
      LIMIT 5
    `, params);

        const campaignStats = campaignStatsResult.rows.map(campaign => ({
            id: campaign.id,
            name: campaign.name,
            totalCalls: parseInt(campaign.total_calls),
            completedCalls: parseInt(campaign.completed_calls),
            scheduledCalls: parseInt(campaign.scheduled_calls),
            interestedCalls: parseInt(campaign.interested_calls),
            avgDuration: parseFloat(campaign.avg_duration),
            totalCost: parseFloat(campaign.total_cost),
            conversionRate: campaign.total_calls > 0 ?
                ((parseInt(campaign.scheduled_calls) + parseInt(campaign.interested_calls)) / parseInt(campaign.total_calls) * 100).toFixed(2) : 0
        }));

        res.json({
            success: true,
            analytics: {
                overview: {
                    totalCampaigns: parseInt(stats.total_campaigns),
                    totalContacts: parseInt(stats.total_contacts),
                    totalCalls: parseInt(stats.total_calls),
                    completedCalls: parseInt(stats.completed_calls),
                    scheduledCalls: parseInt(stats.scheduled_calls),
                    interestedCalls: parseInt(stats.interested_calls),
                    conversionRate: parseFloat(conversionRate),
                    totalCost: parseFloat(stats.total_cost),
                    avgDuration: parseFloat(stats.avg_duration)
                },
                recentCalls,
                campaignPerformance: campaignStats
            }
        });

    } catch (error) {
        logger.error('Dashboard analytics error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch dashboard analytics'
        });
    }
});

// Get ROI calculator
router.get('/roi', async(req, res) => {
    try {
        const { campaign_id, start_date, end_date } = req.query;

        let whereClause = 'WHERE c.organization_id = $1';
        const params = [req.organizationId];
        let paramCount = 1;

        if (campaign_id) {
            paramCount++;
            whereClause += ` AND c.campaign_id = $${paramCount}`;
            params.push(campaign_id);
        }

        if (start_date && end_date) {
            paramCount++;
            whereClause += ` AND c.created_at BETWEEN $${paramCount} AND $${paramCount + 1}`;
            params.push(start_date, end_date);
        }

        const roiResult = await query(`
      SELECT
        COUNT(cl.id) as total_calls,
        COUNT(CASE WHEN cl.outcome = 'scheduled' THEN 1 END) as scheduled_calls,
        COUNT(CASE WHEN cl.outcome = 'interested' THEN 1 END) as interested_calls,
        COALESCE(SUM(cl.cost), 0) as total_cost,
        COALESCE(AVG(cl.duration), 0) as avg_duration
      FROM calls cl
      JOIN contacts ct ON cl.contact_id = ct.id
      JOIN campaigns c ON cl.campaign_id = c.id
      ${whereClause}
    `, params);

        const roi = roiResult.rows[0];
        const totalCalls = parseInt(roi.total_calls);
        const scheduledCalls = parseInt(roi.scheduled_calls);
        const interestedCalls = parseInt(roi.interested_calls);
        const totalCost = parseFloat(roi.total_cost);
        const avgDuration = parseFloat(roi.avg_duration);

        // Calculate ROI metrics
        const conversionRate = totalCalls > 0 ? ((scheduledCalls + interestedCalls) / totalCalls * 100) : 0;
        const costPerCall = totalCalls > 0 ? (totalCost / totalCalls) : 0;
        const costPerConversion = (scheduledCalls + interestedCalls) > 0 ? (totalCost / (scheduledCalls + interestedCalls)) : 0;

        res.json({
            success: true,
            roi: {
                totalCalls,
                scheduledCalls,
                interestedCalls,
                totalConversions: scheduledCalls + interestedCalls,
                conversionRate: parseFloat(conversionRate.toFixed(2)),
                totalCost,
                avgDuration,
                costPerCall: parseFloat(costPerCall.toFixed(4)),
                costPerConversion: parseFloat(costPerConversion.toFixed(2)),
                roi: totalCost > 0 ? (((scheduledCalls + interestedCalls) * 100) / totalCost).toFixed(2) : 0
            }
        });

    } catch (error) {
        logger.error('ROI calculation error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to calculate ROI'
        });
    }
});

module.exports = router;