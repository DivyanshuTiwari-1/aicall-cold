const express = require('express');
const Joi = require('joi');
const { query } = require('../config/database');
const logger = require('../utils/logger');

const router = express.Router();

// Validation schemas
const consentSettingsSchema = Joi.object({
    requireConsent: Joi.boolean().default(true),
    consentScript: Joi.string().min(10).max(1000).required(),
    optOutKeywords: Joi.array().items(Joi.string()).min(1).required(),
    recordingConsent: Joi.boolean().default(true),
    gdprCompliant: Joi.boolean().default(true),
    tcpaCompliant: Joi.boolean().default(true)
});

const logConsentSchema = Joi.object({
    callId: Joi.string().uuid().required(),
    phone: Joi.string().required(),
    consentType: Joi.string().valid('call', 'recording', 'marketing').required(),
    granted: Joi.boolean().required(),
    timestamp: Joi.date().default(() => new Date())
});

// Get compliance metrics
router.get('/metrics', async(req, res) => {
    try {
        const { range = '7d' } = req.query;

        let dateFilter = '';
        switch (range) {
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

        // Get consent metrics
        const consentResult = await query(`
            SELECT
                COUNT(*) as total_calls,
                COUNT(CASE WHEN consent_granted = true THEN 1 END) as consent_count,
                ROUND(
                    COUNT(CASE WHEN consent_granted = true THEN 1 END) * 100.0 / COUNT(*), 2
                ) as consent_rate
            FROM calls
            WHERE organization_id = $1 ${dateFilter}
        `, [req.organizationId]);

        // Get DNC compliance
        const dncResult = await query(`
            SELECT
                COUNT(*) as total_attempts,
                COUNT(CASE WHEN blocked_by_dnc = true THEN 1 END) as blocked_calls,
                ROUND(
                    COUNT(CASE WHEN blocked_by_dnc = true THEN 1 END) * 100.0 / COUNT(*), 2
                ) as dnc_compliance_rate
            FROM call_attempts
            WHERE organization_id = $1 ${dateFilter}
        `, [req.organizationId]);

        // Get blocked calls today
        const blockedTodayResult = await query(`
            SELECT COUNT(*) as blocked_today
            FROM call_attempts
            WHERE organization_id = $1
            AND blocked_by_dnc = true
            AND created_at >= CURRENT_DATE
        `, [req.organizationId]);

        // Calculate compliance score
        const consentRate = parseFloat(consentResult.rows[0].consent_rate) || 0;
        const dncCompliance = parseFloat(dncResult.rows[0].dnc_compliance_rate) || 0;
        const complianceScore = Math.round((consentRate + dncCompliance) / 2);

        const metrics = {
            consentRate: consentRate,
            consentCount: parseInt(consentResult.rows[0].consent_count),
            totalCalls: parseInt(consentResult.rows[0].total_calls),
            dncCompliance: dncCompliance,
            blockedCalls: parseInt(dncResult.rows[0].blocked_calls),
            blockedToday: parseInt(blockedTodayResult.rows[0].blocked_today),
            complianceScore: complianceScore
        };

        res.json({
            success: true,
            metrics
        });

    } catch (error) {
        logger.error('Compliance metrics error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch compliance metrics'
        });
    }
});

// Get audit logs
router.get('/audit-logs', async(req, res) => {
    try {
        const { page = 1, limit = 50, eventType, startDate, endDate } = req.query;
        const offset = (page - 1) * limit;

        let whereClause = 'WHERE organization_id = $1';
        const params = [req.organizationId];
        let paramCount = 1;

        if (eventType) {
            paramCount++;
            whereClause += ` AND event_type = $${paramCount}`;
            params.push(eventType);
        }

        if (startDate) {
            paramCount++;
            whereClause += ` AND created_at >= $${paramCount}`;
            params.push(startDate);
        }

        if (endDate) {
            paramCount++;
            whereClause += ` AND created_at <= $${paramCount}`;
            params.push(endDate);
        }

        // Get total count
        const countResult = await query(`
            SELECT COUNT(*) as total
            FROM compliance_audit_logs
            ${whereClause}
        `, params);

        // Get logs
        const result = await query(`
            SELECT
                id,
                event_type,
                event_data,
                user_id,
                created_at,
                u.first_name,
                u.last_name
            FROM compliance_audit_logs cal
            LEFT JOIN users u ON cal.user_id = u.id
            ${whereClause}
            ORDER BY created_at DESC
            LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
        `, [...params, parseInt(limit), parseInt(offset)]);

        const events = result.rows.map(log => ({
            id: log.id,
            type: log.event_type,
            description: getEventDescription(log.event_type, log.event_data),
            timestamp: log.created_at,
            user: log.first_name && log.last_name ? `${log.first_name} ${log.last_name}` : 'System',
            data: log.event_data
        }));

        res.json({
            success: true,
            events,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: parseInt(countResult.rows[0].total),
                pages: Math.ceil(countResult.rows[0].total / limit)
            }
        });

    } catch (error) {
        logger.error('Audit logs fetch error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch audit logs'
        });
    }
});

// Update consent settings
router.put('/consent-settings', async(req, res) => {
    try {
        const { error, value } = consentSettingsSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: error.details.map(d => d.message)
            });
        }

        // Update or insert consent settings
        const result = await query(`
            INSERT INTO compliance_settings (organization_id, setting_type, setting_value, updated_by)
            VALUES ($1, 'consent', $2, $3)
            ON CONFLICT (organization_id, setting_type)
            DO UPDATE SET
                setting_value = $2,
                updated_by = $3,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *
        `, [req.organizationId, JSON.stringify(value), req.user.id]);

        // Log audit event
        await query(`
            INSERT INTO compliance_audit_logs (organization_id, event_type, event_data, user_id)
            VALUES ($1, $2, $3, $4)
        `, [
            req.organizationId,
            'consent_settings_updated',
            JSON.stringify({
                settings: value,
                updated_by: req.user.id
            }),
            req.user.id
        ]);

        logger.info(`Consent settings updated by user ${req.user.id}`);

        res.json({
            success: true,
            message: 'Consent settings updated successfully',
            settings: value
        });

    } catch (error) {
        logger.error('Consent settings update error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update consent settings'
        });
    }
});

// Get consent settings
router.get('/consent-settings', async(req, res) => {
    try {
        const result = await query(`
            SELECT setting_value
            FROM compliance_settings
            WHERE organization_id = $1 AND setting_type = 'consent'
        `, [req.organizationId]);

        if (result.rows.length > 0) {
            res.json({
                success: true,
                settings: result.rows[0].setting_value
            });
        } else {
            // Return default settings
            const defaultSettings = {
                requireConsent: true,
                consentScript: "Hi {first_name}, this is an automated call from {company} about {topic}. By continuing, you consent to this automated call. If you do not wish to be contacted, say 'Stop' or 'Remove me'.",
                optOutKeywords: ["stop", "remove", "unsubscribe", "don't call", "do not call"],
                recordingConsent: true,
                gdprCompliant: true,
                tcpaCompliant: true
            };

            res.json({
                success: true,
                settings: defaultSettings
            });
        }

    } catch (error) {
        logger.error('Consent settings fetch error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch consent settings'
        });
    }
});

// Log consent event
router.post('/log-consent', async(req, res) => {
    try {
        const { error, value } = logConsentSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: error.details.map(d => d.message)
            });
        }

        const { callId, phone, consentType, granted, timestamp } = value;

        // Update call record
        await query(`
            UPDATE calls
            SET consent_granted = $1, consent_type = $2, consent_timestamp = $3
            WHERE id = $4 AND organization_id = $5
        `, [granted, consentType, timestamp, callId, req.organizationId]);

        // Log audit event
        await query(`
            INSERT INTO compliance_audit_logs (organization_id, event_type, event_data, user_id)
            VALUES ($1, $2, $3, $4)
        `, [
            req.organizationId,
            'consent_logged',
            JSON.stringify({
                callId: callId,
                phone: phone,
                consentType: consentType,
                granted: granted,
                timestamp: timestamp
            }),
            req.user.id
        ]);

        logger.info(`Consent logged: ${consentType} ${granted ? 'granted' : 'denied'} for call ${callId}`);

        res.json({
            success: true,
            message: 'Consent event logged successfully'
        });

    } catch (error) {
        logger.error('Consent logging error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to log consent event'
        });
    }
});

// Log opt-out event
router.post('/log-opt-out', async(req, res) => {
    try {
        const { callId, phone, reason, timestamp } = req.body;

        // Add to DNC list
        await query(`
            INSERT INTO dnc_registry (organization_id, phone, reason, source, added_by)
            VALUES ($1, $2, $3, 'user_request', $4)
            ON CONFLICT (organization_id, phone) DO NOTHING
        `, [req.organizationId, phone, reason || 'opt_out', req.user.id]);

        // Log audit event
        await query(`
            INSERT INTO compliance_audit_logs (organization_id, event_type, event_data, user_id)
            VALUES ($1, $2, $3, $4)
        `, [
            req.organizationId,
            'opt_out_logged',
            JSON.stringify({
                callId: callId,
                phone: phone,
                reason: reason,
                timestamp: timestamp || new Date()
            }),
            req.user.id
        ]);

        logger.info(`Opt-out logged for phone ${phone} from call ${callId}`);

        res.json({
            success: true,
            message: 'Opt-out event logged successfully'
        });

    } catch (error) {
        logger.error('Opt-out logging error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to log opt-out event'
        });
    }
});

// Helper function to generate event descriptions
function getEventDescription(eventType, eventData) {
    const data = typeof eventData === 'string' ? JSON.parse(eventData) : eventData;

    switch (eventType) {
        case 'dnc_added':
            return `Number ${data.phone} added to DNC list (${data.reason})`;
        case 'dnc_removed':
            return `Number ${data.phone} removed from DNC list`;
        case 'consent_logged':
            return `Consent ${data.granted ? 'granted' : 'denied'} for ${data.consentType} on call ${data.callId}`;
        case 'opt_out_logged':
            return `Opt-out logged for ${data.phone} from call ${data.callId}`;
        case 'consent_settings_updated':
            return 'Consent settings updated';
        default:
            return `Event: ${eventType}`;
    }
}

module.exports = router;