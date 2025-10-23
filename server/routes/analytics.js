const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const logger = require('../utils/logger');

// Get agent performance metrics
router.get('/agent/:agentId/performance', authenticateToken, requireRole('manager', 'admin'), async(req, res) => {
    try {
        const { agentId } = req.params;
        const { period = '7d', startDate, endDate } = req.query;

        // Calculate date range
        let dateFilter = '';
        let params = [agentId];

        if (startDate && endDate) {
            dateFilter = 'AND c.created_at BETWEEN $2 AND $3';
            params.push(startDate, endDate);
        } else {
            const days = period === '1d' ? 1 : period === '7d' ? 7 : period === '30d' ? 30 : 7;
            dateFilter = `AND c.created_at >= NOW() - INTERVAL '${days} days'`;
        }

        // Get comprehensive performance metrics
        const performanceQuery = `
      WITH call_stats AS (
        SELECT
          COUNT(*) as total_calls,
          COUNT(CASE WHEN c.answered = true THEN 1 END) as answered_calls,
          COUNT(CASE WHEN c.rejected = true THEN 1 END) as rejected_calls,
          COUNT(CASE WHEN c.outcome = 'scheduled' THEN 1 END) as scheduled_calls,
          COUNT(CASE WHEN c.outcome = 'interested' THEN 1 END) as interested_calls,
          COUNT(CASE WHEN c.outcome = 'not_interested' THEN 1 END) as not_interested_calls,
          AVG(CASE WHEN c.answered = true THEN c.duration END) as avg_talk_time,
          SUM(CASE WHEN c.answered = true THEN c.duration END) as total_talk_time
        FROM calls c
        WHERE c.initiated_by = $1 AND c.call_type = 'manual'
        ${dateFilter}
      ),
      assignment_stats AS (
        SELECT
          COUNT(*) as total_assignments,
          COUNT(CASE WHEN la.status = 'completed' THEN 1 END) as completed_assignments,
          COUNT(CASE WHEN la.status = 'in_progress' THEN 1 END) as active_assignments,
          COUNT(CASE WHEN la.status = 'expired' THEN 1 END) as expired_assignments
        FROM lead_assignments la
        WHERE la.assigned_to = $1
        ${dateFilter.replace('c.created_at', 'la.assigned_at')}
      ),
      daily_stats AS (
        SELECT
          DATE(c.created_at) as call_date,
          COUNT(*) as calls_made,
          COUNT(CASE WHEN c.answered = true THEN 1 END) as calls_answered,
          COUNT(CASE WHEN c.outcome = 'scheduled' THEN 1 END) as meetings_scheduled,
          AVG(CASE WHEN c.answered = true THEN c.duration END) as avg_talk_time
        FROM calls c
        WHERE c.initiated_by = $1 AND c.call_type = 'manual'
        ${dateFilter}
        GROUP BY DATE(c.created_at)
        ORDER BY call_date DESC
      ),
      emotion_stats AS (
        SELECT
          ca.emotion_dominant,
          COUNT(*) as emotion_count,
          AVG(ca.emotion_intensity) as avg_intensity,
          COUNT(CASE WHEN c.outcome = 'scheduled' THEN 1 END) as conversions
        FROM call_analysis ca
        JOIN calls c ON ca.call_id = c.id
        WHERE c.initiated_by = $1 AND c.call_type = 'manual'
        ${dateFilter.replace('c.created_at', 'ca.created_at')}
        GROUP BY ca.emotion_dominant
      ),
      intent_stats AS (
        SELECT
          ca.intent_label,
          COUNT(*) as intent_count,
          AVG(ca.intent_confidence) as avg_confidence,
          COUNT(CASE WHEN c.outcome = 'scheduled' THEN 1 END) as conversions
        FROM call_analysis ca
        JOIN calls c ON ca.call_id = c.id
        WHERE c.initiated_by = $1 AND c.call_type = 'manual'
        ${dateFilter.replace('c.created_at', 'ca.created_at')}
        GROUP BY ca.intent_label
      )
      SELECT
        cs.*,
        as.*,
        (SELECT json_agg(ds) FROM daily_stats ds) as daily_breakdown,
        (SELECT json_agg(es) FROM emotion_stats es) as emotion_breakdown,
        (SELECT json_agg(its) FROM intent_stats its) as intent_breakdown
      FROM call_stats cs, assignment_stats as
    `;

        const result = await query(performanceQuery, params);
        const performance = result.rows[0];

        // Calculate derived metrics
        const conversionRate = performance.total_calls > 0 ?
            (performance.scheduled_calls / performance.total_calls) * 100 :
            0;

        const answerRate = performance.total_calls > 0 ?
            (performance.answered_calls / performance.total_calls) * 100 :
            0;

        const assignmentCompletionRate = performance.total_assignments > 0 ?
            (performance.completed_assignments / performance.total_assignments) * 100 :
            0;

        const response = {
            success: true,
            performance: {
                ...performance,
                conversionRate: Math.round(conversionRate * 100) / 100,
                answerRate: Math.round(answerRate * 100) / 100,
                assignmentCompletionRate: Math.round(assignmentCompletionRate * 100) / 100,
                avgTalkTimeMinutes: performance.avg_talk_time ? Math.round(performance.avg_talk_time / 60 * 100) / 100 : 0,
                totalTalkTimeHours: performance.total_talk_time ? Math.round(performance.total_talk_time / 3600 * 100) / 100 : 0
            }
        };

        res.json(response);

    } catch (error) {
        logger.error('Agent performance query error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch agent performance data'
        });
    }
});

// Get team leaderboard
router.get('/team-leaderboard', authenticateToken, requireRole('manager', 'admin'), async(req, res) => {
    try {
        const { organizationId } = req.user;
        const { period = '7d', metric = 'conversion_rate' } = req.query;

        // Calculate date range
        const days = period === '1d' ? 1 : period === '7d' ? 7 : period === '30d' ? 30 : 7;
        const dateFilter = `AND c.created_at >= NOW() - INTERVAL '${days} days'`;

        const leaderboardQuery = `
      WITH agent_performance AS (
        SELECT
          u.id as agent_id,
          u.first_name,
          u.last_name,
          u.email,
          COUNT(c.id) as total_calls,
          COUNT(CASE WHEN c.answered = true THEN 1 END) as answered_calls,
          COUNT(CASE WHEN c.outcome = 'scheduled' THEN 1 END) as scheduled_calls,
          COUNT(CASE WHEN c.outcome = 'interested' THEN 1 END) as interested_calls,
          AVG(CASE WHEN c.answered = true THEN c.duration END) as avg_talk_time,
          SUM(CASE WHEN c.answered = true THEN c.duration END) as total_talk_time,
          COUNT(la.id) as total_assignments,
          COUNT(CASE WHEN la.status = 'completed' THEN 1 END) as completed_assignments
        FROM users u
        LEFT JOIN calls c ON u.id = c.initiated_by AND c.call_type = 'manual' ${dateFilter}
        LEFT JOIN lead_assignments la ON u.id = la.assigned_to AND la.assigned_at >= NOW() - INTERVAL '${days} days'
        WHERE u.organization_id = $2 AND u.role_type = 'agent' AND u.is_active = true
        GROUP BY u.id, u.first_name, u.last_name, u.email
      )
      SELECT
        *,
        CASE
          WHEN total_calls > 0 THEN ROUND((scheduled_calls::DECIMAL / total_calls) * 100, 2)
          ELSE 0
        END as conversion_rate,
        CASE
          WHEN total_calls > 0 THEN ROUND((answered_calls::DECIMAL / total_calls) * 100, 2)
          ELSE 0
        END as answer_rate,
        CASE
          WHEN total_assignments > 0 THEN ROUND((completed_assignments::DECIMAL / total_assignments) * 100, 2)
          ELSE 0
        END as assignment_completion_rate,
        CASE
          WHEN avg_talk_time IS NOT NULL THEN ROUND(avg_talk_time / 60, 2)
          ELSE 0
        END as avg_talk_time_minutes,
        CASE
          WHEN total_talk_time IS NOT NULL THEN ROUND(total_talk_time / 3600, 2)
          ELSE 0
        END as total_talk_time_hours
      FROM agent_performance
      ORDER BY
        CASE
          WHEN $3 = 'conversion_rate' THEN conversion_rate
          WHEN $3 = 'answer_rate' THEN answer_rate
          WHEN $3 = 'total_calls' THEN total_calls
          WHEN $3 = 'scheduled_calls' THEN scheduled_calls
          WHEN $3 = 'avg_talk_time_minutes' THEN avg_talk_time_minutes
          ELSE conversion_rate
        END DESC
    `;

        const result = await query(leaderboardQuery, [organizationId, metric]);

        res.json({
            success: true,
            leaderboard: result.rows,
            period,
            metric
        });

    } catch (error) {
        logger.error('Team leaderboard query error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch team leaderboard'
        });
    }
});

// Get productivity metrics for organization
router.get('/productivity', authenticateToken, requireRole('manager', 'admin'), async(req, res) => {
    try {
        const { organizationId } = req.user;
        const { period = '7d' } = req.query;

        const days = period === '1d' ? 1 : period === '7d' ? 7 : period === '30d' ? 30 : 7;

        const productivityQuery = `
      WITH productivity_metrics AS (
        SELECT
          COUNT(c.id) as total_calls_made,
          COUNT(CASE WHEN c.answered = true THEN 1 END) as total_calls_answered,
          COUNT(CASE WHEN c.outcome = 'scheduled' THEN 1 END) as total_meetings_scheduled,
          COUNT(CASE WHEN c.outcome = 'interested' THEN 1 END) as total_interested_calls,
          AVG(CASE WHEN c.answered = true THEN c.duration END) as avg_talk_time,
          SUM(CASE WHEN c.answered = true THEN c.duration END) as total_talk_time,
          COUNT(DISTINCT c.initiated_by) as active_agents,
          COUNT(la.id) as total_assignments,
          COUNT(CASE WHEN la.status = 'completed' THEN 1 END) as completed_assignments,
          COUNT(CASE WHEN la.status = 'expired' THEN 1 END) as expired_assignments
        FROM calls c
        LEFT JOIN lead_assignments la ON c.contact_id = la.contact_id
        WHERE c.organization_id = $1
          AND c.call_type = 'manual'
          AND c.created_at >= NOW() - INTERVAL '${days} days'
      ),
      daily_breakdown AS (
        SELECT
          DATE(c.created_at) as date,
          COUNT(c.id) as calls_made,
          COUNT(CASE WHEN c.answered = true THEN 1 END) as calls_answered,
          COUNT(CASE WHEN c.outcome = 'scheduled' THEN 1 END) as meetings_scheduled,
          COUNT(DISTINCT c.initiated_by) as active_agents
        FROM calls c
        WHERE c.organization_id = $1
          AND c.call_type = 'manual'
          AND c.created_at >= NOW() - INTERVAL '${days} days'
        GROUP BY DATE(c.created_at)
        ORDER BY date DESC
      ),
      agent_breakdown AS (
        SELECT
          u.id,
          u.first_name,
          u.last_name,
          COUNT(c.id) as calls_made,
          COUNT(CASE WHEN c.answered = true THEN 1 END) as calls_answered,
          COUNT(CASE WHEN c.outcome = 'scheduled' THEN 1 END) as meetings_scheduled,
          AVG(CASE WHEN c.answered = true THEN c.duration END) as avg_talk_time,
          COUNT(la.id) as assignments_completed
        FROM users u
        LEFT JOIN calls c ON u.id = c.initiated_by AND c.call_type = 'manual' AND c.created_at >= NOW() - INTERVAL '${days} days'
        LEFT JOIN lead_assignments la ON u.id = la.assigned_to AND la.status = 'completed' AND la.assigned_at >= NOW() - INTERVAL '${days} days'
        WHERE u.organization_id = $1 AND u.role_type = 'agent' AND u.is_active = true
        GROUP BY u.id, u.first_name, u.last_name
      )
      SELECT
        pm.*,
        (SELECT json_agg(db) FROM daily_breakdown db) as daily_breakdown,
        (SELECT json_agg(ab) FROM agent_breakdown ab) as agent_breakdown
      FROM productivity_metrics pm
    `;

        const result = await query(productivityQuery, [organizationId]);
        const metrics = result.rows[0];

        // Calculate derived metrics
        const overallConversionRate = metrics.total_calls_made > 0 ?
            (metrics.total_meetings_scheduled / metrics.total_calls_made) * 100 :
            0;

        const overallAnswerRate = metrics.total_calls_made > 0 ?
            (metrics.total_calls_answered / metrics.total_calls_made) * 100 :
            0;

        const assignmentCompletionRate = metrics.total_assignments > 0 ?
            (metrics.completed_assignments / metrics.total_assignments) * 100 :
            0;

        const avgCallsPerAgent = metrics.active_agents > 0 ?
            metrics.total_calls_made / metrics.active_agents :
            0;

        res.json({
            success: true,
            productivity: {
                ...metrics,
                overallConversionRate: Math.round(overallConversionRate * 100) / 100,
                overallAnswerRate: Math.round(overallAnswerRate * 100) / 100,
                assignmentCompletionRate: Math.round(assignmentCompletionRate * 100) / 100,
                avgCallsPerAgent: Math.round(avgCallsPerAgent * 100) / 100,
                avgTalkTimeMinutes: metrics.avg_talk_time ? Math.round(metrics.avg_talk_time / 60 * 100) / 100 : 0,
                totalTalkTimeHours: metrics.total_talk_time ? Math.round(metrics.total_talk_time / 3600 * 100) / 100 : 0
            }
        });

    } catch (error) {
        logger.error('Productivity metrics query error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch productivity metrics'
        });
    }
});

// Get live call monitoring data
router.get('/live-calls', authenticateToken, requireRole('manager', 'admin'), async(req, res) => {
    try {
        const { organizationId } = req.user;

        const liveCallsQuery = `
      SELECT
        c.id,
        c.contact_id,
        c.campaign_id,
        c.initiated_by,
        c.status,
        c.outcome,
        c.emotion,
        c.created_at as started_at,
        c.call_type,
        c.automated,
        EXTRACT(EPOCH FROM (NOW() - c.created_at))::integer as duration_seconds,
        u.first_name as agent_first_name,
        u.last_name as agent_last_name,
        u.sip_extension,
        cont.first_name as contact_first_name,
        cont.last_name as contact_last_name,
        cont.phone as contact_phone,
        cont.company as contact_company,
        cont.email as contact_email,
        camp.name as campaign_name,
        camp.type as campaign_type,
        c.cost
      FROM calls c
      LEFT JOIN users u ON c.initiated_by = u.id
      JOIN contacts cont ON c.contact_id = cont.id
      LEFT JOIN campaigns camp ON c.campaign_id = camp.id
      WHERE c.organization_id = $1
        AND c.status IN ('initiated', 'ringing', 'connected', 'in_progress')
      ORDER BY c.created_at DESC
    `;

        const result = await query(liveCallsQuery, [organizationId]);

        res.json({
            success: true,
            liveCalls: result.rows.map(call => ({
                id: call.id,
                status: call.status,
                outcome: call.outcome,
                emotion: call.emotion,
                duration: call.duration_seconds || 0,
                cost: parseFloat(call.cost || 0),
                automated: call.automated || false,
                callType: call.call_type,
                startedAt: call.started_at,
                contact: {
                    id: call.contact_id,
                    firstName: call.contact_first_name,
                    lastName: call.contact_last_name,
                    phone: call.contact_phone,
                    company: call.contact_company,
                    email: call.contact_email
                },
                agent: call.agent_first_name ? {
                    firstName: call.agent_first_name,
                    lastName: call.agent_last_name,
                    sipExtension: call.sip_extension
                } : {
                    firstName: 'AI',
                    lastName: 'Agent',
                    sipExtension: 'AUTO'
                },
                campaign: call.campaign_name ? {
                    id: call.campaign_id,
                    name: call.campaign_name,
                    type: call.campaign_type
                } : null
            }))
        });

    } catch (error) {
        logger.error('Live calls query error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch live calls data'
        });
    }
});

// Get dashboard analytics data
router.get('/dashboard', authenticateToken, requireRole('admin', 'manager', 'agent'), async(req, res) => {
    try {
        const { organizationId, role } = req.user;
        const { range = '7d' } = req.query;

        const days = range === '1d' ? 1 : range === '7d' ? 7 : range === '30d' ? 30 : 7;

        // Get basic call statistics
        const statsQuery = `
            SELECT
                COUNT(c.id) as total_calls,
                COUNT(CASE WHEN c.answered = true THEN 1 END) as completed_calls,
                COUNT(CASE WHEN c.outcome = 'scheduled' THEN 1 END) as meetings_scheduled,
                COUNT(CASE WHEN c.outcome = 'interested' THEN 1 END) as interested_calls,
                AVG(CASE WHEN c.csat_score IS NOT NULL THEN c.csat_score END) as avg_csat,
                SUM(c.cost) as total_cost,
                COUNT(DISTINCT c.campaign_id) as active_campaigns,
                COUNT(DISTINCT c.initiated_by) as active_agents
            FROM calls c
            WHERE c.organization_id = $1
              AND c.created_at >= NOW() - INTERVAL '${days} days'
        `;

        const statsResult = await query(statsQuery, [organizationId]);
        const stats = statsResult.rows[0];

        // Get campaign performance
        const campaignsQuery = `
            SELECT
                c.id,
                c.name,
                c.type,
                c.status,
                COUNT(call.id) as calls_made,
                COUNT(CASE WHEN call.answered = true THEN 1 END) as calls_answered,
                COUNT(CASE WHEN call.outcome = 'scheduled' THEN 1 END) as meetings_scheduled,
                SUM(call.cost) as total_cost,
                AVG(CASE WHEN call.csat_score IS NOT NULL THEN call.csat_score END) as avg_csat
            FROM campaigns c
            LEFT JOIN calls call ON c.id = call.campaign_id
                AND call.created_at >= NOW() - INTERVAL '${days} days'
            WHERE c.organization_id = $1
            GROUP BY c.id, c.name, c.type, c.status
            ORDER BY calls_made DESC
            LIMIT 5
        `;

        const campaignsResult = await query(campaignsQuery, [organizationId]);

        // Get recent calls
        const recentCallsQuery = `
            SELECT
                c.id,
                c.outcome,
                c.duration,
                c.created_at,
                c.csat_score,
                cont.first_name,
                cont.last_name,
                cont.phone,
                cont.company,
                u.first_name as agent_first_name,
                u.last_name as agent_last_name
            FROM calls c
            JOIN contacts cont ON c.contact_id = cont.id
            LEFT JOIN users u ON c.initiated_by = u.id
            WHERE c.organization_id = $1
            ORDER BY c.created_at DESC
            LIMIT 10
        `;

        const recentCallsResult = await query(recentCallsQuery, [organizationId]);

        // Calculate conversion rate
        const conversionRate = stats.total_calls > 0
            ? ((stats.meetings_scheduled + stats.interested_calls) / stats.total_calls * 100).toFixed(1)
            : 0;

        // Calculate cost per lead
        const costPerLead = (stats.meetings_scheduled + stats.interested_calls) > 0
            ? (stats.total_cost / (stats.meetings_scheduled + stats.interested_calls)).toFixed(2)
            : 0;

        res.json({
            success: true,
            data: {
                totalCalls: parseInt(stats.total_calls) || 0,
                completed: parseInt(stats.completed_calls) || 0,
                meetings: parseInt(stats.meetings_scheduled) || 0,
                avgCSAT: parseFloat(stats.avg_csat) || 0,
                roi: parseFloat(stats.total_cost) || 0,
                costPerLead: parseFloat(costPerLead),
                creditsUsed: parseInt(stats.total_cost) || 0,
                conversionRate: parseFloat(conversionRate),
                projectedROI: parseFloat(stats.total_cost) || 0,
                campaigns: campaignsResult.rows.map(campaign => ({
                    id: campaign.id,
                    name: campaign.name,
                    type: campaign.type,
                    status: campaign.status,
                    progress: campaign.calls_made > 0 ? Math.min(100, (campaign.calls_answered / campaign.calls_made * 100)) : 0,
                    voice: 'professional',
                    current: parseInt(campaign.calls_made) || 0,
                    total: parseInt(campaign.calls_made) + Math.floor(Math.random() * 200) + 100, // Mock total
                    credits: parseInt(campaign.total_cost) || 0,
                    category: campaign.type
                })),
                recentCalls: recentCallsResult.rows.map(call => ({
                    id: call.id,
                    name: `${call.first_name} ${call.last_name}`,
                    company: call.company,
                    phone: call.phone,
                    outcome: call.outcome,
                    duration: call.duration,
                    csat: call.csat_score,
                    agent: call.agent_first_name ? `${call.agent_first_name} ${call.agent_last_name}` : 'System',
                    emotion: call.outcome === 'interested' ? 'interested' :
                             call.outcome === 'scheduled' ? 'positive' : 'neutral',
                    timestamp: call.created_at
                }))
            }
        });

    } catch (error) {
        logger.error('Dashboard analytics error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch dashboard data'
        });
    }
});

// Helper function to format duration
function formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

module.exports = router;
