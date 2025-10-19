const express = require('express');
const Joi = require('joi');
const csv = require('csv-parser');
const { query } = require('../config/database');
const logger = require('../utils/logger');
const { authenticateToken, requireRole } = require('../middleware/auth');
const {
    processUnpickedLeads,
    calculateReuseMetrics,
    getReuseSettings,
    updateReuseSettings,
    triggerManualReuse
} = require('../services/lead-reuse');

const router = express.Router();

// Get all assignments
router.get('/', authenticateToken, requireRole('admin', 'manager', 'agent'), async(req, res) => {
    try {
        const { campaign, status, search, limit = 50, offset = 0 } = req.query;

        let whereClause = 'WHERE la.organization_id = $1';
        const params = [req.organizationId];
        let paramCount = 1;

        if (campaign) {
            paramCount++;
            whereClause += ` AND c.campaign_id = $${paramCount}`;
            params.push(campaign);
        }

        if (status) {
            paramCount++;
            whereClause += ` AND la.status = $${paramCount}`;
            params.push(status);
        }

        if (search) {
            paramCount++;
            whereClause += ` AND (c.first_name ILIKE $${paramCount} OR c.last_name ILIKE $${paramCount} OR c.phone ILIKE $${paramCount} OR c.email ILIKE $${paramCount})`;
            params.push(`%${search}%`);
        }

        // First check if lead_assignments table exists
        const tableCheck = await query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_name = 'lead_assignments'
            )
        `);

        if (!tableCheck.rows[0].exists) {
            // Table doesn't exist, return empty result
            return res.json({
                success: true,
                assignments: [],
                pagination: {
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    total: 0
                }
            });
        }

        const result = await query(`
            SELECT
                la.id,
                la.contact_id,
                la.assigned_to,
                la.assigned_by,
                la.status,
                la.assigned_at as created_at,
                la.assigned_at as updated_at,
                c.first_name,
                c.last_name,
                c.phone,
                c.email,
                c.company,
                c.title,
                camp.name as campaign_name,
                ua.first_name as agent_first_name,
                ua.last_name as agent_last_name,
                ua.email as agent_email,
                ub.first_name as assigned_by_first_name,
                ub.last_name as assigned_by_last_name
            FROM lead_assignments la
            JOIN contacts c ON la.contact_id = c.id
            LEFT JOIN campaigns camp ON c.campaign_id = camp.id
            LEFT JOIN users ua ON la.assigned_to = ua.id
            LEFT JOIN users ub ON la.assigned_by = ub.id
            ${whereClause}
            ORDER BY la.assigned_at DESC
            LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
        `, [...params, parseInt(limit), parseInt(offset)]);

        const assignments = result.rows.map(row => ({
            id: row.id,
            contactId: row.contact_id,
            assignedTo: row.assigned_to,
            assignedBy: row.assigned_by,
            status: row.status,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            contact: {
                id: row.contact_id,
                firstName: row.first_name,
                lastName: row.last_name,
                phone: row.phone,
                email: row.email,
                company: row.company,
                title: row.title,
                campaignName: row.campaign_name
            },
            agent: {
                id: row.assigned_to,
                firstName: row.agent_first_name,
                lastName: row.agent_last_name,
                email: row.agent_email
            },
            assignedBy: {
                id: row.assigned_by,
                firstName: row.assigned_by_first_name,
                lastName: row.assigned_by_last_name
            }
        }));

        res.json({
            success: true,
            assignments,
            pagination: {
                limit: parseInt(limit),
                offset: parseInt(offset),
                total: assignments.length
            }
        });

    } catch (error) {
        logger.error('Get assignments error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch assignments'
        });
    }
});

// Validation schemas
const assignLeadsSchema = Joi.object({
    contactIds: Joi.array().items(Joi.string().uuid()).min(1).required(),
    assignedTo: Joi.string().uuid().required(),
    expiresAt: Joi.date().greater('now').optional()
}).options({ stripUnknown: true });

const bulkAssignSchema = Joi.object({
    agentId: Joi.string().uuid().required(),
    count: Joi.number().integer().min(1).max(100).required(),
    campaignId: Joi.string().uuid().optional(),
    filters: Joi.object({
        status: Joi.string().valid('new', 'retry_pending'),
        industry: Joi.string(),
        location: Joi.string()
    }).optional()
});

// Assign specific leads to agent
router.post('/assign', authenticateToken, requireRole('admin', 'manager', 'data_uploader'), async(req, res) => {
    try {
        logger.info('Assignment request received:', {
            body: req.body,
            user: req.user?.email,
            organizationId: req.organizationId
        });

        const { error, value } = assignLeadsSchema.validate(req.body);
        if (error) {
            logger.error('Assignment validation error:', {
                body: req.body,
                errors: error.details.map(d => d.message),
                user: req.user?.email
            });
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: error.details.map(d => d.message),
                received: req.body
            });
        }

        const { contactIds, assignedTo, expiresAt } = value;

        // Verify agent exists and belongs to organization
        const agentCheck = await query(`
            SELECT id, first_name, last_name FROM users
            WHERE id = $1 AND organization_id = $2 AND is_active = true
        `, [assignedTo, req.organizationId]);

        if (agentCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Agent not found or inactive'
            });
        }

        const agent = agentCheck.rows[0];

        // Verify contacts exist and belong to organization
        const contactCheck = await query(`
            SELECT id, first_name, last_name, phone FROM contacts
            WHERE id = ANY($1) AND organization_id = $2
        `, [contactIds, req.organizationId]);

        if (contactCheck.rows.length !== contactIds.length) {
            return res.status(400).json({
                success: false,
                message: 'Some contacts not found or don\'t belong to organization'
            });
        }

        // Check for existing assignments to any agent
        const existingAssignments = await query(`
            SELECT c.id, c.first_name, c.last_name, la.assigned_to, u.first_name as agent_first_name, u.last_name as agent_last_name
            FROM contacts c
            JOIN lead_assignments la ON c.id = la.contact_id
            LEFT JOIN users u ON la.assigned_to = u.id
            WHERE c.id = ANY($1) AND la.status IN ('pending', 'in_progress')
        `, [contactIds]);

        if (existingAssignments.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'Some contacts are already assigned to other agents',
                conflicts: existingAssignments.rows.map(c => ({
                    id: c.id,
                    name: `${c.first_name} ${c.last_name}`,
                    assignedTo: `${c.agent_first_name} ${c.agent_last_name}`
                }))
            });
        }

        // Create assignments
        const assignments = contactIds.map(contactId => ({
            organization_id: req.organizationId,
            contact_id: contactId,
            assigned_to: assignedTo,
            assigned_by: req.user.id,
            expires_at: expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours default
        }));

        const insertValues = assignments.map((_, index) => {
            const offset = index * 5;
            return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5})`;
        }).join(',');

        const insertParams = assignments.flatMap(a => [
            a.organization_id, a.contact_id, a.assigned_to, a.assigned_by, a.expires_at
        ]);

        await query(`
            INSERT INTO lead_assignments (organization_id, contact_id, assigned_to, assigned_by, expires_at)
            VALUES ${insertValues}
        `, insertParams);

        // Update agent's assigned leads count
        await query(`
            UPDATE users
            SET assigned_leads_count = assigned_leads_count + $1
            WHERE id = $2
        `, [contactIds.length, assignedTo]);

        // Log audit event
        await query(`
            INSERT INTO audit_logs (organization_id, user_id, action, resource_type, resource_id, details)
            VALUES ($1, $2, 'leads_assigned', 'assignment', $3, $4)
        `, [req.organizationId, req.user.id, assignedTo, JSON.stringify({
            contactCount: contactIds.length,
            assignedTo: agent.first_name + ' ' + agent.last_name,
            assignedBy: req.user.email
        })]);

        logger.info(`Assigned ${contactIds.length} leads to agent ${agent.first_name} ${agent.last_name}`);

        res.status(201).json({
            success: true,
            message: `${contactIds.length} leads assigned successfully`,
            assignment: {
                agentId: assignedTo,
                agentName: `${agent.first_name} ${agent.last_name}`,
                contactCount: contactIds.length,
                expiresAt: expiresAt
            }
        });

    } catch (error) {
        logger.error('Assign leads error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to assign leads'
        });
    }
});

// Bulk assign leads to agent
router.post('/bulk-assign', authenticateToken, requireRole('admin', 'manager', 'data_uploader'), async(req, res) => {
    try {
        const { error, value } = bulkAssignSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: error.details.map(d => d.message)
            });
        }

        const { agentId, count, campaignId, filters = {} } = value;

        // Verify agent exists
        const agentCheck = await query(`
            SELECT id, first_name, last_name FROM users
            WHERE id = $1 AND organization_id = $2 AND is_active = true
        `, [agentId, req.organizationId]);

        if (agentCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Agent not found or inactive'
            });
        }

        const agent = agentCheck.rows[0];

        // Build query to find available contacts
        let whereClause = 'c.organization_id = $1 AND c.status IN (\'new\', \'retry_pending\')';
        let queryParams = [req.organizationId];
        let paramCount = 1;

        if (campaignId) {
            paramCount++;
            whereClause += ` AND c.campaign_id = $${paramCount}`;
            queryParams.push(campaignId);
        }

        if (filters.status) {
            paramCount++;
            whereClause += ` AND c.status = $${paramCount}`;
            queryParams.push(filters.status);
        }

        if (filters.industry) {
            paramCount++;
            whereClause += ` AND c.industry = $${paramCount}`;
            queryParams.push(filters.industry);
        }

        if (filters.location) {
            paramCount++;
            whereClause += ` AND c.location ILIKE $${paramCount}`;
            queryParams.push(`%${filters.location}%`);
        }

        // Exclude already assigned contacts
        whereClause += ` AND NOT EXISTS (
            SELECT 1 FROM lead_assignments la
            WHERE la.contact_id = c.id
              AND la.status IN ('pending', 'in_progress')
        )`;

        // Find available contacts
        const availableContacts = await query(`
            SELECT c.id, c.first_name, c.last_name, c.phone, c.company
            FROM contacts c
            WHERE ${whereClause}
            ORDER BY c.created_at ASC
            LIMIT $${paramCount + 1}
        `, [...queryParams, count]);

        if (availableContacts.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No available contacts found for assignment'
            });
        }

        const contactIds = availableContacts.rows.map(c => c.id);
        const actualCount = contactIds.length;

        // Create assignments
        const assignments = contactIds.map(contactId => ({
            organization_id: req.organizationId,
            contact_id: contactId,
            assigned_to: agentId,
            assigned_by: req.user.id,
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
        }));

        const insertValues = assignments.map((_, index) => {
            const offset = index * 5;
            return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5})`;
        }).join(',');

        const insertParams = assignments.flatMap(a => [
            a.organization_id, a.contact_id, a.assigned_to, a.assigned_by, a.expires_at
        ]);

        await query(`
            INSERT INTO lead_assignments (organization_id, contact_id, assigned_to, assigned_by, expires_at)
            VALUES ${insertValues}
        `, insertParams);

        // Update agent's assigned leads count
        await query(`
            UPDATE users
            SET assigned_leads_count = assigned_leads_count + $1
            WHERE id = $2
        `, [actualCount, agentId]);

        // Log audit event
        await query(`
            INSERT INTO audit_logs (organization_id, user_id, action, resource_type, resource_id, details)
            VALUES ($1, $2, 'bulk_leads_assigned', 'assignment', $3, $4)
        `, [req.organizationId, req.user.id, agentId, JSON.stringify({
            contactCount: actualCount,
            requestedCount: count,
            assignedTo: agent.first_name + ' ' + agent.last_name,
            filters: filters,
            campaignId: campaignId
        })]);

        logger.info(`Bulk assigned ${actualCount} leads to agent ${agent.first_name} ${agent.last_name}`);

        res.status(201).json({
            success: true,
            message: `${actualCount} leads assigned successfully`,
            assignment: {
                agentId: agentId,
                agentName: `${agent.first_name} ${agent.last_name}`,
                contactCount: actualCount,
                requestedCount: count,
                contacts: availableContacts.rows.map(c => ({
                    id: c.id,
                    name: `${c.first_name} ${c.last_name}`,
                    phone: c.phone,
                    company: c.company
                }))
            }
        });

    } catch (error) {
        logger.error('Bulk assign leads error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to bulk assign leads'
        });
    }
});

// Get my assigned leads
router.get('/my-leads', authenticateToken, requireRole('agent', 'admin', 'manager'), async(req, res) => {
    try {
        const { status = 'pending', limit = 50, offset = 0 } = req.query;

        const result = await query(`
            SELECT la.id, la.status, la.assigned_at, la.expires_at,
                   c.id as contact_id, c.first_name, c.last_name, c.phone, c.email,
                   c.company, c.title, c.industry, c.location, c.custom_fields,
                   c.status as contact_status, c.last_contacted,
                   camp.name as campaign_name, camp.type as campaign_type
            FROM lead_assignments la
            JOIN contacts c ON la.contact_id = c.id
            LEFT JOIN campaigns camp ON c.campaign_id = camp.id
            WHERE la.assigned_to = $1
              AND la.organization_id = $2
              AND la.status = $3
            ORDER BY la.assigned_at ASC
            LIMIT $4 OFFSET $5
        `, [req.user.id, req.organizationId, status, parseInt(limit), parseInt(offset)]);

        const totalResult = await query(`
            SELECT COUNT(*) as total
            FROM lead_assignments la
            WHERE la.assigned_to = $1
              AND la.organization_id = $2
              AND la.status = $3
        `, [req.user.id, req.organizationId, status]);

        res.json({
            success: true,
            leads: result.rows.map(lead => ({
                assignmentId: lead.id,
                status: lead.status,
                assignedAt: lead.assigned_at,
                expiresAt: lead.expires_at,
                contact: {
                    id: lead.contact_id,
                    firstName: lead.first_name,
                    lastName: lead.last_name,
                    phone: lead.phone,
                    email: lead.email,
                    company: lead.company,
                    title: lead.title,
                    industry: lead.industry,
                    location: lead.location,
                    customFields: lead.custom_fields,
                    status: lead.contact_status,
                    lastContacted: lead.last_contacted
                },
                campaign: {
                    name: lead.campaign_name,
                    type: lead.campaign_type
                }
            })),
            pagination: {
                total: parseInt(totalResult.rows[0].total),
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: result.rows.length === parseInt(limit)
            }
        });

    } catch (error) {
        logger.error('Get my leads error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch assigned leads'
        });
    }
});

// Update assignment status
router.put('/:id/status', authenticateToken, requireRole('agent', 'admin', 'manager'), async(req, res) => {
    try {
        const assignmentId = req.params.id;
        const { status } = req.body;

        if (!['pending', 'in_progress', 'completed', 'expired'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status'
            });
        }

        // Verify assignment belongs to user or user is admin/manager
        const assignmentCheck = await query(`
            SELECT la.id, la.assigned_to, la.contact_id, c.first_name, c.last_name
            FROM lead_assignments la
            JOIN contacts c ON la.contact_id = c.id
            WHERE la.id = $1 AND la.organization_id = $2
        `, [assignmentId, req.organizationId]);

        if (assignmentCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Assignment not found'
            });
        }

        const assignment = assignmentCheck.rows[0];

        // Check permissions
        if (req.user.role_type === 'agent' && assignment.assigned_to !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        // Update assignment status
        await query(`
            UPDATE lead_assignments
            SET status = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
        `, [status, assignmentId]);

        // If completed, update agent's assigned leads count
        if (status === 'completed') {
            await query(`
                UPDATE users
                SET assigned_leads_count = GREATEST(assigned_leads_count - 1, 0)
                WHERE id = $1
            `, [assignment.assigned_to]);
        }

        // Log audit event
        await query(`
            INSERT INTO audit_logs (organization_id, user_id, action, resource_type, resource_id, details)
            VALUES ($1, $2, 'assignment_status_updated', 'assignment', $3, $4)
        `, [req.organizationId, req.user.id, assignmentId, JSON.stringify({
            newStatus: status,
            contactName: `${assignment.first_name} ${assignment.last_name}`,
            updatedBy: req.user.email
        })]);

        res.json({
            success: true,
            message: 'Assignment status updated successfully'
        });

    } catch (error) {
        logger.error('Update assignment status error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update assignment status'
        });
    }
});

// Get assignment statistics
router.get('/stats', authenticateToken, requireRole('admin', 'manager', 'agent'), async(req, res) => {
    try {
        const { period = '7d' } = req.query;

        let dateFilter = '';
        if (period === '1d') {
            dateFilter = 'AND la.assigned_at >= CURRENT_DATE';
        } else if (period === '7d') {
            dateFilter = 'AND la.assigned_at >= CURRENT_DATE - INTERVAL \'7 days\'';
        } else if (period === '30d') {
            dateFilter = 'AND la.assigned_at >= CURRENT_DATE - INTERVAL \'30 days\'';
        }

        const result = await query(`
            SELECT
                COUNT(*) as total_assignments,
                COUNT(CASE WHEN la.status = 'pending' THEN 1 END) as pending_assignments,
                COUNT(CASE WHEN la.status = 'in_progress' THEN 1 END) as in_progress_assignments,
                COUNT(CASE WHEN la.status = 'completed' THEN 1 END) as completed_assignments,
                COUNT(CASE WHEN la.status = 'expired' THEN 1 END) as expired_assignments,
                COUNT(DISTINCT la.assigned_to) as active_agents
            FROM lead_assignments la
            WHERE la.organization_id = $1 ${dateFilter}
        `, [req.organizationId]);

        const stats = result.rows[0];

        res.json({
            success: true,
            stats: {
                totalAssignments: parseInt(stats.total_assignments) || 0,
                pendingAssignments: parseInt(stats.pending_assignments) || 0,
                inProgressAssignments: parseInt(stats.in_progress_assignments) || 0,
                completedAssignments: parseInt(stats.completed_assignments) || 0,
                expiredAssignments: parseInt(stats.expired_assignments) || 0,
                activeAgents: parseInt(stats.active_agents) || 0,
                completionRate: stats.total_assignments > 0 ?
                    Math.round((stats.completed_assignments / stats.total_assignments) * 100) : 0
            }
        });

    } catch (error) {
        logger.error('Get assignment stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch assignment statistics'
        });
    }
});

// Lead Reuse Endpoints

// Process unpicked leads for automatic reuse
router.post('/reuse', authenticateToken, requireRole('admin', 'manager'), async(req, res) => {
    try {
        const result = await processUnpickedLeads(req.organizationId);

        res.json({
            success: true,
            message: `Processed ${result.processed} leads for reuse`,
            result
        });

    } catch (error) {
        logger.error('Process unpicked leads error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process unpicked leads'
        });
    }
});

// Get reuse statistics
router.get('/reuse-stats', authenticateToken, requireRole('admin', 'manager'), async(req, res) => {
    try {
        const { startDate, endDate } = req.query;

        const metrics = await calculateReuseMetrics(req.organizationId, startDate, endDate);

        res.json({
            success: true,
            metrics
        });

    } catch (error) {
        logger.error('Get reuse stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch reuse statistics'
        });
    }
});

// Get reuse settings
router.get('/reuse-settings', authenticateToken, requireRole('admin', 'manager'), async(req, res) => {
    try {
        const settings = await getReuseSettings(req.organizationId);

        res.json({
            success: true,
            settings: {
                autoReuseEnabled: settings.auto_reuse_enabled,
                maxReuseAttempts: settings.max_reuse_attempts,
                reuseDelayHours: settings.reuse_delay_hours,
                reuseTimeWindows: settings.reuse_time_windows
            }
        });

    } catch (error) {
        logger.error('Get reuse settings error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch reuse settings'
        });
    }
});

// Update reuse settings
router.put('/reuse-settings', authenticateToken, requireRole('admin', 'manager'), async(req, res) => {
    try {
        const { error, value } = Joi.object({
            autoReuseEnabled: Joi.boolean().required(),
            maxReuseAttempts: Joi.number().integer().min(1).max(10).required(),
            reuseDelayHours: Joi.number().integer().min(1).max(168).required(), // Max 1 week
            reuseTimeWindows: Joi.object({
                enabled: Joi.boolean(),
                startTime: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
                endTime: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
                days: Joi.array().items(Joi.string().valid('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'))
            }).optional()
        }).validate(req.body);

        if (error) {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: error.details.map(d => d.message)
            });
        }

        const settings = await updateReuseSettings(req.organizationId, value);

        res.json({
            success: true,
            message: 'Reuse settings updated successfully',
            settings: {
                autoReuseEnabled: settings.auto_reuse_enabled,
                maxReuseAttempts: settings.max_reuse_attempts,
                reuseDelayHours: settings.reuse_delay_hours,
                reuseTimeWindows: settings.reuse_time_windows
            }
        });

    } catch (error) {
        logger.error('Update reuse settings error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update reuse settings'
        });
    }
});

// Manually trigger reuse for specific leads
router.post('/manual-reuse', authenticateToken, requireRole('admin', 'manager'), async(req, res) => {
    try {
        const { error, value } = Joi.object({
            contactIds: Joi.array().items(Joi.string().uuid()).min(1).max(50).required()
        }).validate(req.body);

        if (error) {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: error.details.map(d => d.message)
            });
        }

        const { contactIds } = value;
        const result = await triggerManualReuse(req.organizationId, contactIds);

        res.json({
            success: true,
            message: `Manual reuse completed: ${result.successful}/${result.total} successful`,
            result
        });

    } catch (error) {
        logger.error('Manual reuse error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to trigger manual reuse'
        });
    }
});

// Get unpicked leads (for manual reuse selection)
router.get('/unpicked-leads', authenticateToken, requireRole('admin', 'manager'), async(req, res) => {
    try {
        const { limit = 50, offset = 0 } = req.query;

        const result = await query(`
            SELECT
                c.id,
                c.first_name,
                c.last_name,
                c.phone,
                c.email,
                c.company,
                c.reuse_count,
                c.last_reuse_at,
                cl.id as last_call_id,
                cl.outcome,
                cl.created_at as last_call_at,
                camp.name as campaign_name
            FROM contacts c
            LEFT JOIN LATERAL (
                SELECT id, outcome, created_at
                FROM calls
                WHERE contact_id = c.id
                ORDER BY created_at DESC
                LIMIT 1
            ) cl ON true
            LEFT JOIN campaigns camp ON c.campaign_id = camp.id
            WHERE c.organization_id = $1
            AND c.reuse_enabled = true
            AND c.reuse_count < 3
            AND cl.outcome IN ('no_answer', 'busy', 'missed')
            AND cl.created_at < NOW() - INTERVAL '24 hours'
            ORDER BY cl.created_at ASC
            LIMIT $2 OFFSET $3
        `, [req.organizationId, parseInt(limit), parseInt(offset)]);

        const totalResult = await query(`
            SELECT COUNT(*) as total
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
            AND c.reuse_count < 3
            AND cl.outcome IN ('no_answer', 'busy', 'missed')
            AND cl.created_at < NOW() - INTERVAL '24 hours'
        `, [req.organizationId]);

        res.json({
            success: true,
            leads: result.rows.map(lead => ({
                id: lead.id,
                firstName: lead.first_name,
                lastName: lead.last_name,
                phone: lead.phone,
                email: lead.email,
                company: lead.company,
                reuseCount: lead.reuse_count,
                lastReuseAt: lead.last_reuse_at,
                lastCall: {
                    id: lead.last_call_id,
                    outcome: lead.outcome,
                    createdAt: lead.last_call_at
                },
                campaign: {
                    name: lead.campaign_name
                }
            })),
            pagination: {
                total: parseInt(totalResult.rows[0].total),
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: result.rows.length === parseInt(limit)
            }
        });

    } catch (error) {
        logger.error('Get unpicked leads error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch unpicked leads'
        });
    }
});

module.exports = router;
