const { query } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Lead Reuse Service for managing automatic lead reuse for unpicked calls
 */

/**
 * Process unpicked leads for automatic reuse
 * @param {string} organizationId - Organization ID
 * @returns {Object} Processing results
 */
async function processUnpickedLeads(organizationId) {
    try {
        logger.info(`Processing unpicked leads for organization ${organizationId}`);

        // Get reuse settings for organization
        const settingsResult = await query(`
            SELECT * FROM reuse_settings
            WHERE organization_id = $1
        `, [organizationId]);

        if (settingsResult.rows.length === 0) {
            logger.warn(`No reuse settings found for organization ${organizationId}`);
            return { processed: 0, message: 'No reuse settings configured' };
        }

        const settings = settingsResult.rows[0];

        if (!settings.auto_reuse_enabled) {
            logger.info(`Auto reuse disabled for organization ${organizationId}`);
            return { processed: 0, message: 'Auto reuse disabled' };
        }

        // Find leads eligible for reuse
        const eligibleLeads = await findEligibleLeads(organizationId, settings);

        let processedCount = 0;
        const results = [];

        for (const lead of eligibleLeads) {
            try {
                const result = await reuseLead(lead, settings);
                results.push(result);
                processedCount++;
            } catch (error) {
                logger.error(`Error reusing lead ${lead.contact_id}:`, error);
                results.push({
                    contactId: lead.contact_id,
                    success: false,
                    error: error.message
                });
            }
        }

        logger.info(`Processed ${processedCount} leads for reuse in organization ${organizationId}`);

        return {
            processed: processedCount,
            results,
            settings: {
                maxReuseAttempts: settings.max_reuse_attempts,
                reuseDelayHours: settings.reuse_delay_hours
            }
        };

    } catch (error) {
        logger.error('Error processing unpicked leads:', error);
        throw error;
    }
}

/**
 * Find leads eligible for reuse
 * @param {string} organizationId - Organization ID
 * @param {Object} settings - Reuse settings
 * @returns {Array} Eligible leads
 */
async function findEligibleLeads(organizationId, settings) {
    const delayHours = settings.reuse_delay_hours || 24;
    const maxAttempts = settings.max_reuse_attempts || 3;

    const result = await query(`
        SELECT
            c.id as contact_id,
            c.first_name,
            c.last_name,
            c.phone,
            c.reuse_count,
            c.last_reuse_at,
            c.campaign_id,
            c.organization_id,
            cl.id as last_call_id,
            cl.outcome,
            cl.created_at as last_call_at
        FROM contacts c
        LEFT JOIN LATERAL (
            SELECT id, outcome, created_at
            FROM calls
            WHERE contact_id = c.id
            ORDER BY created_at DESC
            LIMIT 1
        ) cl ON true
        WHERE c.organization_id = $1
        AND c.reuse_enabled = true
        AND c.reuse_count < $2
        AND (
            c.last_reuse_at IS NULL
            OR c.last_reuse_at < NOW() - INTERVAL '${delayHours} hours'
        )
        AND cl.outcome IN ('no_answer', 'busy', 'missed')
        AND cl.created_at < NOW() - INTERVAL '${delayHours} hours'
        ORDER BY cl.created_at ASC
        LIMIT 100
    `, [organizationId, maxAttempts]);

    return result.rows;
}

/**
 * Reuse a specific lead
 * @param {Object} lead - Lead data
 * @param {Object} settings - Reuse settings
 * @returns {Object} Reuse result
 */
async function reuseLead(lead, settings) {
    try {
        // Find available agent for reassignment
        const availableAgent = await findAvailableAgent(lead.organization_id);

        if (!availableAgent) {
            return {
                contactId: lead.contact_id,
                success: false,
                error: 'No available agents for reassignment'
            };
        }

        // Update contact reuse count and timestamp
        await query(`
            UPDATE contacts
            SET
                reuse_count = reuse_count + 1,
                last_reuse_at = NOW(),
                status = 'new'
            WHERE id = $1
        `, [lead.contact_id]);

        // Create reuse log entry
        await query(`
            INSERT INTO reuse_logs (
                contact_id,
                original_call_id,
                reuse_reason,
                reassigned_to,
                reuse_attempt
            ) VALUES ($1, $2, $3, $4, $5)
        `, [
            lead.contact_id,
            lead.last_call_id,
            'automatic_reuse',
            availableAgent.id,
            lead.reuse_count + 1
        ]);

        // Create new lead assignment
        await query(`
            INSERT INTO lead_assignments (
                organization_id,
                contact_id,
                assigned_to,
                assigned_by,
                status
            ) VALUES ($1, $2, $3, $4, 'pending')
        `, [
            lead.organization_id,
            lead.contact_id,
            availableAgent.id,
            null // System assignment
        ]);

        logger.info(`Lead ${lead.contact_id} reused and assigned to agent ${availableAgent.id}`);

        return {
            contactId: lead.contact_id,
            success: true,
            assignedTo: availableAgent.id,
            agentName: `${availableAgent.first_name} ${availableAgent.last_name}`,
            reuseAttempt: lead.reuse_count + 1
        };

    } catch (error) {
        logger.error(`Error reusing lead ${lead.contact_id}:`, error);
        throw error;
    }
}

/**
 * Find an available agent for lead assignment
 * @param {string} organizationId - Organization ID
 * @returns {Object|null} Available agent or null
 */
async function findAvailableAgent(organizationId) {
    const result = await query(`
        SELECT id, first_name, last_name, assigned_leads_count
        FROM users
        WHERE organization_id = $1
        AND role_type = 'agent'
        AND is_active = true
        AND is_available = true
        ORDER BY assigned_leads_count ASC
        LIMIT 1
    `, [organizationId]);

    return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * Calculate reuse metrics for organization
 * @param {string} organizationId - Organization ID
 * @param {string} startDate - Start date filter
 * @param {string} endDate - End date filter
 * @returns {Object} Reuse metrics
 */
async function calculateReuseMetrics(organizationId, startDate = null, endDate = null) {
    try {
        let dateFilter = '';
        const params = [organizationId];

        if (startDate && endDate) {
            dateFilter = 'AND rl.created_at BETWEEN $2 AND $3';
            params.push(startDate, endDate);
        } else {
            // Default to last 30 days
            dateFilter = 'AND rl.created_at >= NOW() - INTERVAL \'30 days\'';
        }

        // Get reuse statistics
        const statsResult = await query(`
            SELECT
                COUNT(*) as total_reuses,
                COUNT(CASE WHEN rl.reuse_attempt = 1 THEN 1 END) as first_time_reuses,
                COUNT(CASE WHEN rl.reuse_attempt > 1 THEN 1 END) as multiple_reuses,
                AVG(rl.reuse_attempt) as avg_reuse_attempts,
                COUNT(CASE WHEN c.status = 'contacted' THEN 1 END) as successful_reuses
            FROM reuse_logs rl
            JOIN contacts c ON rl.contact_id = c.id
            WHERE c.organization_id = $1 ${dateFilter}
        `, params);

        // Get reuse effectiveness by attempt
        const effectivenessResult = await query(`
            SELECT
                rl.reuse_attempt,
                COUNT(*) as total_attempts,
                COUNT(CASE WHEN c.status = 'contacted' THEN 1 END) as successful_attempts,
                ROUND(
                    COUNT(CASE WHEN c.status = 'contacted' THEN 1 END)::DECIMAL / COUNT(*) * 100, 2
                ) as success_rate
            FROM reuse_logs rl
            JOIN contacts c ON rl.contact_id = c.id
            WHERE c.organization_id = $1 ${dateFilter}
            GROUP BY rl.reuse_attempt
            ORDER BY rl.reuse_attempt
        `, params);

        // Get recent reuse activity
        const recentActivityResult = await query(`
            SELECT
                DATE(rl.created_at) as date,
                COUNT(*) as reuses_count,
                COUNT(CASE WHEN c.status = 'contacted' THEN 1 END) as successful_reuses
            FROM reuse_logs rl
            JOIN contacts c ON rl.contact_id = c.id
            WHERE c.organization_id = $1 ${dateFilter}
            GROUP BY DATE(rl.created_at)
            ORDER BY date DESC
            LIMIT 30
        `, params);

        const stats = statsResult.rows[0];
        const totalReuses = parseInt(stats.total_reuses) || 0;
        const successfulReuses = parseInt(stats.successful_reuses) || 0;
        const successRate = totalReuses > 0 ? (successfulReuses / totalReuses * 100).toFixed(2) : 0;

        return {
            totalReuses,
            firstTimeReuses: parseInt(stats.first_time_reuses) || 0,
            multipleReuses: parseInt(stats.multiple_reuses) || 0,
            avgReuseAttempts: parseFloat(stats.avg_reuse_attempts) || 0,
            successfulReuses,
            successRate: parseFloat(successRate),
            effectivenessByAttempt: effectivenessResult.rows.map(row => ({
                attempt: row.reuse_attempt,
                totalAttempts: parseInt(row.total_attempts),
                successfulAttempts: parseInt(row.successful_attempts),
                successRate: parseFloat(row.success_rate)
            })),
            recentActivity: recentActivityResult.rows.map(row => ({
                date: row.date,
                reusesCount: parseInt(row.reuses_count),
                successfulReuses: parseInt(row.successful_reuses)
            }))
        };

    } catch (error) {
        logger.error('Error calculating reuse metrics:', error);
        throw error;
    }
}

/**
 * Get reuse settings for organization
 * @param {string} organizationId - Organization ID
 * @returns {Object} Reuse settings
 */
async function getReuseSettings(organizationId) {
    try {
        const result = await query(`
            SELECT * FROM reuse_settings
            WHERE organization_id = $1
        `, [organizationId]);

        if (result.rows.length === 0) {
            // Create default settings
            return await createDefaultReuseSettings(organizationId);
        }

        return result.rows[0];

    } catch (error) {
        logger.error('Error getting reuse settings:', error);
        throw error;
    }
}

/**
 * Update reuse settings for organization
 * @param {string} organizationId - Organization ID
 * @param {Object} settings - New settings
 * @returns {Object} Updated settings
 */
async function updateReuseSettings(organizationId, settings) {
    try {
        const result = await query(`
            INSERT INTO reuse_settings (
                organization_id,
                auto_reuse_enabled,
                max_reuse_attempts,
                reuse_delay_hours,
                reuse_time_windows
            ) VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (organization_id) DO UPDATE SET
                auto_reuse_enabled = EXCLUDED.auto_reuse_enabled,
                max_reuse_attempts = EXCLUDED.max_reuse_attempts,
                reuse_delay_hours = EXCLUDED.reuse_delay_hours,
                reuse_time_windows = EXCLUDED.reuse_time_windows,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *
        `, [
            organizationId,
            settings.autoReuseEnabled,
            settings.maxReuseAttempts,
            settings.reuseDelayHours,
            JSON.stringify(settings.reuseTimeWindows || {})
        ]);

        logger.info(`Updated reuse settings for organization ${organizationId}`);
        return result.rows[0];

    } catch (error) {
        logger.error('Error updating reuse settings:', error);
        throw error;
    }
}

/**
 * Create default reuse settings for organization
 * @param {string} organizationId - Organization ID
 * @returns {Object} Default settings
 */
async function createDefaultReuseSettings(organizationId) {
    try {
        const result = await query(`
            INSERT INTO reuse_settings (
                organization_id,
                auto_reuse_enabled,
                max_reuse_attempts,
                reuse_delay_hours,
                reuse_time_windows
            ) VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `, [
            organizationId,
            true,
            3,
            24,
            JSON.stringify({
                enabled: true,
                startTime: '09:00',
                endTime: '17:00',
                days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
            })
        ]);

        return result.rows[0];

    } catch (error) {
        logger.error('Error creating default reuse settings:', error);
        throw error;
    }
}

/**
 * Manually trigger reuse for specific leads
 * @param {string} organizationId - Organization ID
 * @param {Array} contactIds - Contact IDs to reuse
 * @returns {Object} Reuse results
 */
async function triggerManualReuse(organizationId, contactIds) {
    try {
        logger.info(`Manual reuse triggered for ${contactIds.length} leads in organization ${organizationId}`);

        const settings = await getReuseSettings(organizationId);
        const results = [];

        for (const contactId of contactIds) {
            try {
                // Get lead data
                const leadResult = await query(`
                    SELECT c.*, cl.id as last_call_id, cl.outcome, cl.created_at as last_call_at
                    FROM contacts c
                    LEFT JOIN LATERAL (
                        SELECT id, outcome, created_at
                        FROM calls
                        WHERE contact_id = c.id
                        ORDER BY created_at DESC
                        LIMIT 1
                    ) cl ON true
                    WHERE c.id = $1 AND c.organization_id = $2
                `, [contactId, organizationId]);

                if (leadResult.rows.length === 0) {
                    results.push({
                        contactId,
                        success: false,
                        error: 'Lead not found'
                    });
                    continue;
                }

                const lead = leadResult.rows[0];
                const result = await reuseLead(lead, settings);
                results.push(result);

            } catch (error) {
                logger.error(`Error manually reusing lead ${contactId}:`, error);
                results.push({
                    contactId,
                    success: false,
                    error: error.message
                });
            }
        }

        const successCount = results.filter(r => r.success).length;
        logger.info(`Manual reuse completed: ${successCount}/${contactIds.length} successful`);

        return {
            total: contactIds.length,
            successful: successCount,
            failed: contactIds.length - successCount,
            results
        };

    } catch (error) {
        logger.error('Error triggering manual reuse:', error);
        throw error;
    }
}

module.exports = {
    processUnpickedLeads,
    calculateReuseMetrics,
    getReuseSettings,
    updateReuseSettings,
    triggerManualReuse
};
