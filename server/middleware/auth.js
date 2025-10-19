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
            'SELECT id, email, first_name, last_name, role, role_type, is_active, is_available, sip_extension, organization_id FROM users WHERE id = $1', [decoded.userId]
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

function requireRole(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        const userRoleType = req.user.role_type;

        if (!allowedRoles.includes(userRoleType)) {
            return res.status(403).json({
                success: false,
                message: 'Access denied',
                required: allowedRoles,
                current: userRoleType
            });
        }

        next();
    };
}

function requireAdmin(req, res, next) {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: 'Authentication required'
        });
    }

    if (req.user.role_type !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'Admin access required'
        });
    }

    next();
}

function requireManagerOrAdmin(req, res, next) {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: 'Authentication required'
        });
    }

    if (!['admin', 'manager'].includes(req.user.role_type)) {
        return res.status(403).json({
            success: false,
            message: 'Manager or Admin access required'
        });
    }

    next();
}

function requireAgentOrAbove(req, res, next) {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: 'Authentication required'
        });
    }

    if (!['admin', 'manager', 'agent'].includes(req.user.role_type)) {
        return res.status(403).json({
            success: false,
            message: 'Agent access or above required'
        });
    }

    next();
}

function requireDataUploaderOrAbove(req, res, next) {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: 'Authentication required'
        });
    }

    if (!['admin', 'data_uploader'].includes(req.user.role_type)) {
        return res.status(403).json({
            success: false,
            message: 'Data Uploader access or above required'
        });
    }

    next();
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
    requireAdmin,
    requireManagerOrAdmin,
    requireAgentOrAbove,
    requireDataUploaderOrAbove,
    requireOrganizationAccess
};
