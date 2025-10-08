const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Joi = require('joi');
const { query } = require('../config/database');
const logger = require('../utils/logger');

const router = express.Router();

// Validation schemas
const registerSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
    firstName: Joi.string().min(2).max(100).required(),
    lastName: Joi.string().min(2).max(100).required(),
    organizationName: Joi.string().min(2).max(255).required(),
    organizationDomain: Joi.string().allow('', null).optional()
});

const loginSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
});

// Register new user and organization
router.post('/register', async(req, res) => {
    try {
        const { error, value } = registerSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: error.details.map(d => d.message)
            });
        }

        const { email, password, firstName, lastName, organizationName, organizationDomain } = value;

        // Convert empty string to null for domain
        const domain = organizationDomain && organizationDomain.trim() !== '' ? organizationDomain.trim() : null;

        // Check if user already exists
        const existingUser = await query('SELECT id FROM users WHERE email = $1', [email]);
        if (existingUser.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'User with this email already exists'
            });
        }

        // Check if organization domain already exists
        if (domain) {
            const existingOrg = await query('SELECT id FROM organizations WHERE domain = $1', [domain]);
            if (existingOrg.rows.length > 0) {
                return res.status(409).json({
                    success: false,
                    message: 'Organization with this domain already exists'
                });
            }
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 12);

        // Create organization and user in transaction
        const result = await query(`
      WITH new_org AS (
        INSERT INTO organizations (name, domain, settings)
        VALUES ($1, $2, '{"timezone": "UTC", "features": ["emotion_detection"]}')
        RETURNING id
      )
      INSERT INTO users (organization_id, email, password_hash, first_name, last_name, role)
      SELECT new_org.id, $3, $4, $5, $6, 'admin'
      FROM new_org
      RETURNING id, organization_id, email, first_name, last_name, role
    `, [organizationName, domain, email, passwordHash, firstName, lastName]);

        const user = result.rows[0];

        // Generate JWT token
        const token = jwt.sign({ userId: user.id, organizationId: user.organization_id },
            process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
        );

        logger.info(`New user registered: ${email}`);

        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            token,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                role: user.role,
                organizationId: user.organization_id
            }
        });

    } catch (error) {
        logger.error('Registration error:', error);
        res.status(500).json({
            success: false,
            message: 'Registration failed'
        });
    }
});

// Login user
router.post('/login', async(req, res) => {
    try {
        const { error, value } = loginSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: error.details.map(d => d.message)
            });
        }

        const { email, password } = value;

        // Find user with organization info
        const userResult = await query(`
      SELECT u.id, u.email, u.password_hash, u.first_name, u.last_name, u.role, u.is_active,
             o.id as organization_id, o.name as organization_name
      FROM users u
      JOIN organizations o ON u.organization_id = o.id
      WHERE u.email = $1
    `, [email]);

        if (userResult.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        const user = userResult.rows[0];

        if (!user.is_active) {
            return res.status(401).json({
                success: false,
                message: 'Account is inactive'
            });
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Generate JWT token
        const token = jwt.sign({ userId: user.id, organizationId: user.organization_id },
            process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
        );

        logger.info(`User logged in: ${email}`);

        res.json({
            success: true,
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                role: user.role,
                organizationId: user.organization_id,
                organizationName: user.organization_name
            }
        });

    } catch (error) {
        logger.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Login failed'
        });
    }
});

// Get current user profile
router.get('/profile', async(req, res) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Access token required'
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const userResult = await query(`
      SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.is_active,
             o.id as organization_id, o.name as organization_name, o.settings
      FROM users u
      JOIN organizations o ON u.organization_id = o.id
      WHERE u.id = $1
    `, [decoded.userId]);

        if (userResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const user = userResult.rows[0];

        res.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                role: user.role,
                organizationId: user.organization_id,
                organizationName: user.organization_name,
                organizationSettings: user.settings
            }
        });

    } catch (error) {
        logger.error('Profile fetch error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch profile'
        });
    }
});

// Refresh token
router.post('/refresh', async(req, res) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(400).json({
                success: false,
                message: 'Refresh token required'
            });
        }

        // In a production app, you'd validate the refresh token against a database
        // For now, we'll just generate a new token if the current one is valid
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Access token required'
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Generate new token
        const newToken = jwt.sign({ userId: decoded.userId, organizationId: decoded.organizationId },
            process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
        );

        res.json({
            success: true,
            token: newToken
        });

    } catch (error) {
        logger.error('Token refresh error:', error);
        res.status(401).json({
            success: false,
            message: 'Invalid refresh token'
        });
    }
});

module.exports = router;