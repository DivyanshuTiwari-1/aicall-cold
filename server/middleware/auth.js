const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const logger = require('../utils/logger');

async function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Access token required'
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Verify user still exists and is active
        const userResult = await query(
            'SELECT id, email, first_name, last_name, role, is_active, organization_id FROM users WHERE id = $1', [decoded.userId]
        );

        if (userResult.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'User not found'
            });
        }

        const user = userResult.rows[0];

        if (!user.is_active) {
            return res.status(401).json({
                success: false,
                message: 'User account is inactive'
            });
        }

        req.user = user;
        req.organizationId = user.organization_id;
        next();
    } catch (error) {
        logger.error('Token verification failed:', error);
        return res.status(403).json({
            success: false,
            message: 'Invalid or expired token'
        });
    }
}

function requireRole(roles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        const userRole = req.user.role;
        const allowedRoles = Array.isArray(roles) ? roles : [roles];

        if (!allowedRoles.includes(userRole)) {
            return res.status(403).json({
                success: false,
                message: 'Insufficient permissions'
            });
        }

        next();
    };
}

function requireOrganizationAccess(req, res, next) {
    const organizationId = req.params.organizationId || req.body.organization_id || req.query.organization_id;

    if (!organizationId) {
        return res.status(400).json({
            success: false,
            message: 'Organization ID required'
        });
    }

    if (req.user.organization_id !== organizationId) {
        return res.status(403).json({
            success: false,
            message: 'Access denied to this organization'
        });
    }

    next();
}

module.exports = {
    authenticateToken,
    requireRole,
    requireOrganizationAccess
};