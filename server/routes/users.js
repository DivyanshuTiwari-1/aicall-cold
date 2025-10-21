const express = require('express');
const bcrypt = require('bcryptjs');
const Joi = require('joi');
const { query } = require('../config/database');
const logger = require('../utils/logger');
const { authenticateToken, requireRole } = require('../middleware/auth');
const sipProvisioning = require('../services/sip-provisioning');

const router = express.Router();

// Validation schemas
const createUserSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
    firstName: Joi.string().min(2).max(100).required(),
    lastName: Joi.string().min(2).max(100).required(),
    roleType: Joi.string().valid('admin', 'manager', 'agent', 'data_uploader').required(),
    dailyCallTarget: Joi.number().integer().min(1).max(200).default(50)
});

const updateUserSchema = Joi.object({
    firstName: Joi.string().min(2).max(100),
    lastName: Joi.string().min(2).max(100),
    roleType: Joi.string().valid('admin', 'manager', 'agent', 'data_uploader'),
    dailyCallTarget: Joi.number().integer().min(1).max(200),
    isActive: Joi.boolean(),
    isAvailable: Joi.boolean()
});

// Get all users in organization
router.get('/', authenticateToken, async(req, res) => {
    try {
        const { role } = req.query;

        let whereClause = 'WHERE u.organization_id = $1';
        let params = [req.organizationId];

        if (role) {
            whereClause += ' AND u.role_type = $2';
            params.push(role);
        }

        const result = await query(`
            SELECT u.id, u.email, u.first_name, u.last_name, u.role_type,
                   u.daily_call_target, u.assigned_leads_count, u.sip_extension,
                   u.is_active, u.is_available, u.created_at,
                   COUNT(c.id) as total_calls,
                   COUNT(CASE WHEN c.call_type = 'manual' THEN 1 END) as manual_calls,
                   COUNT(CASE WHEN c.answered = true THEN 1 END) as answered_calls
            FROM users u
            LEFT JOIN calls c ON u.id = c.initiated_by
            ${whereClause}
            GROUP BY u.id, u.email, u.first_name, u.last_name, u.role_type,
                     u.daily_call_target, u.assigned_leads_count, u.sip_extension,
                     u.is_active, u.is_available, u.created_at
            ORDER BY u.created_at DESC
        `, params);

        res.json({
            success: true,
            users: result.rows.map(user => ({
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                roleType: user.role_type,
                dailyCallTarget: user.daily_call_target,
                assignedLeadsCount: user.assigned_leads_count,
                sipExtension: user.sip_extension,
                isActive: user.is_active,
                isAvailable: user.is_available,
                totalCalls: parseInt(user.total_calls) || 0,
                manualCalls: parseInt(user.manual_calls) || 0,
                answeredCalls: parseInt(user.answered_calls) || 0,
                createdAt: user.created_at
            }))
        });
    } catch (error) {
        logger.error('Get users error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch users'
        });
    }
});

// Create new user
router.post('/', authenticateToken, requireRole('admin'), async(req, res) => {
    try {
        const { error, value } = createUserSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: error.details.map(d => d.message)
            });
        }

        const { email, password, firstName, lastName, roleType, dailyCallTarget } = value;

        // Check if user already exists
        const existingUser = await query('SELECT id FROM users WHERE email = $1', [email]);
        if (existingUser.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'User with this email already exists'
            });
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 12);

        // Create user first (without SIP credentials)
        const result = await query(`
            INSERT INTO users (organization_id, email, password_hash, first_name, last_name,
                             role_type, daily_call_target)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id, email, first_name, last_name, role_type, daily_call_target,
                     is_active, created_at
        `, [req.organizationId, email, passwordHash, firstName, lastName,
            roleType, dailyCallTarget
        ]);

        const user = result.rows[0];

        // Provision SIP credentials for agents
        if (roleType === 'agent') {
            try {
                const sipExtension = sipProvisioning.generateSipExtension(user.id);
                const sipPassword = sipProvisioning.generateSipCredentials();
                const sipUsername = sipProvisioning.generateSipUsername(sipExtension);

                // Provision the SIP endpoint
                await sipProvisioning.provisionAgentEndpoint(user.id, sipExtension, sipUsername, sipPassword);

                // Update user with SIP credentials
                await query(`
                    UPDATE users
                    SET sip_extension = $1, sip_username = $2, sip_password = $3
                    WHERE id = $4
                `, [sipExtension, sipUsername, sipPassword, user.id]);

                // Add SIP credentials to user object
                user.sip_extension = sipExtension;
                user.sip_username = sipUsername;

                logger.info(`SIP endpoint provisioned for agent ${user.id}: ${sipExtension}`);

            } catch (sipError) {
                logger.error(`Failed to provision SIP for agent ${user.id}:`, sipError);
                // Don't fail user creation if SIP provisioning fails
                // The user can still be created and SIP can be provisioned later
            }
        }

        // Log audit event
        await query(`
            INSERT INTO audit_logs (organization_id, user_id, action, resource_type, resource_id, details)
            VALUES ($1, $2, 'user_created', 'user', $3, $4)
        `, [req.organizationId, req.user.id, user.id, JSON.stringify({
            email: user.email,
            roleType: user.role_type,
            createdBy: req.user.email
        })]);

        logger.info(`New user created: ${email} with role ${roleType}`);

        res.status(201).json({
            success: true,
            message: 'User created successfully',
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                roleType: user.role_type,
                dailyCallTarget: user.daily_call_target,
                sipExtension: user.sip_extension,
                sipUsername: user.sip_username,
                isActive: user.is_active,
                createdAt: user.created_at
            }
        });

    } catch (error) {
        logger.error('Create user error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create user'
        });
    }
});

// Update user
router.put('/:id', authenticateToken, requireRole('admin', 'manager'), async(req, res) => {
    try {
        const { error, value } = updateUserSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: error.details.map(d => d.message)
            });
        }

        const userId = req.params.id;
        const updates = value;

        // Check if user exists and belongs to organization
        const userCheck = await query(`
            SELECT id, role_type FROM users
            WHERE id = $1 AND organization_id = $2
        `, [userId, req.organizationId]);

        if (userCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Non-admin users can only update their own profile
        if (req.user.role_type !== 'admin' && req.user.id !== userId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        // Build dynamic update query
        const updateFields = [];
        const updateValues = [];
        let paramCount = 1;

        Object.keys(updates).forEach(key => {
            const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
            updateFields.push(`${dbKey} = $${paramCount}`);
            updateValues.push(updates[key]);
            paramCount++;
        });

        if (updateFields.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No valid fields to update'
            });
        }

        updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
        updateValues.push(userId, req.organizationId);

        const result = await query(`
            UPDATE users
            SET ${updateFields.join(', ')}
            WHERE id = $${paramCount} AND organization_id = $${paramCount + 1}
            RETURNING id, email, first_name, last_name, role_type, daily_call_target,
                     sip_extension, is_active, is_available, updated_at
        `, updateValues);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const user = result.rows[0];

        // Log audit event
        await query(`
            INSERT INTO audit_logs (organization_id, user_id, action, resource_type, resource_id, details)
            VALUES ($1, $2, 'user_updated', 'user', $3, $4)
        `, [req.organizationId, req.user.id, userId, JSON.stringify({
            updatedFields: Object.keys(updates),
            updatedBy: req.user.email
        })]);

        res.json({
            success: true,
            message: 'User updated successfully',
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                roleType: user.role_type,
                dailyCallTarget: user.daily_call_target,
                sipExtension: user.sip_extension,
                isActive: user.is_active,
                isAvailable: user.is_available,
                updatedAt: user.updated_at
            }
        });

    } catch (error) {
        logger.error('Update user error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update user'
        });
    }
});

// Deactivate user
router.delete('/:id', authenticateToken, requireRole('admin'), async(req, res) => {
    try {
        const userId = req.params.id;

        // Check if user exists and belongs to organization
        const userCheck = await query(`
            SELECT id, email, role_type FROM users
            WHERE id = $1 AND organization_id = $2
        `, [userId, req.organizationId]);

        if (userCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const user = userCheck.rows[0];

        // Prevent deactivating self
        if (req.user.id === userId) {
            return res.status(400).json({
                success: false,
                message: 'Cannot deactivate your own account'
            });
        }

        // Soft delete - set is_active to false
        await query(`
            UPDATE users
            SET is_active = false, updated_at = CURRENT_TIMESTAMP
            WHERE id = $1 AND organization_id = $2
        `, [userId, req.organizationId]);

        // Log audit event
        await query(`
            INSERT INTO audit_logs (organization_id, user_id, action, resource_type, resource_id, details)
            VALUES ($1, $2, 'user_deactivated', 'user', $3, $4)
        `, [req.organizationId, req.user.id, userId, JSON.stringify({
            deactivatedUser: user.email,
            deactivatedBy: req.user.email
        })]);

        logger.info(`User deactivated: ${user.email} by ${req.user.email}`);

        res.json({
            success: true,
            message: 'User deactivated successfully'
        });

    } catch (error) {
        logger.error('Deactivate user error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to deactivate user'
        });
    }
});

// Get user performance stats
router.get('/:id/performance', authenticateToken, async(req, res) => {
    try {
        const userId = req.params.id;
        const { period = '7d' } = req.query;

        // Calculate date range
        let dateFilter = '';
        let params = [userId, req.organizationId];

        if (period === '1d') {
            dateFilter = 'AND c.created_at >= CURRENT_DATE';
        } else if (period === '7d') {
            dateFilter = 'AND c.created_at >= CURRENT_DATE - INTERVAL \'7 days\'';
        } else if (period === '30d') {
            dateFilter = 'AND c.created_at >= CURRENT_DATE - INTERVAL \'30 days\'';
        }

        const result = await query(`
            SELECT
                COUNT(c.id) as total_calls,
                COUNT(CASE WHEN c.call_type = 'manual' THEN 1 END) as manual_calls,
                COUNT(CASE WHEN c.answered = true THEN 1 END) as answered_calls,
                COUNT(CASE WHEN c.outcome = 'scheduled' THEN 1 END) as scheduled_calls,
                COUNT(CASE WHEN c.outcome = 'interested' THEN 1 END) as interested_calls,
                AVG(c.duration) as avg_duration,
                SUM(c.duration) as total_talk_time,
                COUNT(DISTINCT DATE(c.created_at)) as active_days
            FROM calls c
            WHERE c.initiated_by = $1
              AND c.organization_id = $2
              ${dateFilter}
        `, params);

        const stats = result.rows[0];

        // Get recent call outcomes
        const recentCalls = await query(`
            SELECT c.id, c.outcome, c.duration, c.created_at,
                   co.first_name, co.last_name, co.phone
            FROM calls c
            JOIN contacts co ON c.contact_id = co.id
            WHERE c.initiated_by = $1
              AND c.organization_id = $2
              ${dateFilter}
            ORDER BY c.created_at DESC
            LIMIT 10
        `, params);

        res.json({
            success: true,
            performance: {
                totalCalls: parseInt(stats.total_calls) || 0,
                manualCalls: parseInt(stats.manual_calls) || 0,
                answeredCalls: parseInt(stats.answered_calls) || 0,
                scheduledCalls: parseInt(stats.scheduled_calls) || 0,
                interestedCalls: parseInt(stats.interested_calls) || 0,
                avgDuration: Math.round(parseFloat(stats.avg_duration) || 0),
                totalTalkTime: parseInt(stats.total_talk_time) || 0,
                activeDays: parseInt(stats.active_days) || 0,
                conversionRate: stats.total_calls > 0 ?
                    Math.round((stats.scheduled_calls / stats.total_calls) * 100) : 0,
                answerRate: stats.total_calls > 0 ?
                    Math.round((stats.answered_calls / stats.total_calls) * 100) : 0
            },
            recentCalls: recentCalls.rows.map(call => ({
                id: call.id,
                outcome: call.outcome,
                duration: call.duration,
                createdAt: call.created_at,
                contactName: `${call.first_name} ${call.last_name}`,
                contactPhone: call.phone
            }))
        });

    } catch (error) {
        logger.error('Get user performance error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch user performance'
        });
    }
});

// Get current user's SIP credentials
router.get('/me/sip-credentials', authenticateToken, async(req, res) => {
    try {
        const user = req.user;

        if (user.roleType !== 'agent') {
            return res.status(403).json({
                success: false,
                message: 'SIP credentials are only available for agents'
            });
        }

        // Get SIP configuration from provisioning service
        const sipConfig = await sipProvisioning.getAgentSipConfig(user.id);

        if (!sipConfig) {
            return res.status(404).json({
                success: false,
                message: 'SIP credentials not found. Please contact administrator.'
            });
        }

        res.json({
            success: true,
            sipCredentials: {
                extension: sipConfig.extension,
                username: sipConfig.username,
                password: sipConfig.password,
                server: sipConfig.server,
                port: sipConfig.port,
                transport: sipConfig.transport,
                domain: process.env.ASTERISK_HOST || 'localhost'
            }
        });

    } catch (error) {
        logger.error('Get SIP credentials error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get SIP credentials'
        });
    }
});

// Helper functions
async function generateNextSIPExtension() {
    const result = await query(`
        SELECT COALESCE(MAX(CAST(sip_extension AS INTEGER)), 1000) + 1 as next_ext
        FROM users
        WHERE sip_extension IS NOT NULL AND sip_extension ~ '^[0-9]+$'
    `);
    return result.rows[0].next_ext.toString();
}

function generateSecurePassword() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let password = '';
    for (let i = 0; i < 12; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
}

module.exports = router;
