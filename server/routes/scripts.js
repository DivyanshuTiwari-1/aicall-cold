const express = require('express');
const Joi = require('joi');
const { query } = require('../config/database');
const logger = require('../utils/logger');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Middleware to handle organization ID for AGI scripts
router.use(async (req, res, next) => {
    // Skip middleware if already authenticated
    if (req.organizationId) {
        return next();
    }

    // For AGI scripts, try to get organization from call_id
    const call_id = req.body?.call_id || req.query?.call_id || req.params?.call_id;
    if (call_id) {
        try {
            const result = await query('SELECT organization_id FROM calls WHERE id = $1', [call_id]);
            if (result.rows.length > 0) {
                req.organizationId = result.rows[0].organization_id;
            } else {
                const orgResult = await query('SELECT id FROM organizations LIMIT 1');
                req.organizationId = orgResult.rows[0]?.id || 'default-org';
            }
        } catch (error) {
            logger.warn('Could not lookup organization_id:', error.message);
            try {
                const orgResult = await query('SELECT id FROM organizations LIMIT 1');
                req.organizationId = orgResult.rows[0]?.id || 'default-org';
            } catch (orgError) {
                req.organizationId = 'default-org';
            }
        }
    } else {
        try {
            const orgResult = await query('SELECT id FROM organizations LIMIT 1');
            req.organizationId = orgResult.rows[0]?.id || 'default-org';
        } catch (error) {
            req.organizationId = 'default-org';
        }
    }
    next();
});

// Validation schemas
const scriptSchema = Joi.object({
    name: Joi.string().min(3).max(255).required(),
    type: Joi.string().valid('main_pitch', 'follow_up', 'objection_handling', 'closing').required(),
    content: Joi.string().min(10).max(5000).required(),
    description: Joi.string().max(500).optional().allow('', null),
    variables: Joi.object().default({}),
    is_active: Joi.boolean().default(true),
    status: Joi.string().valid('active', 'inactive').optional(), // Accept status field from frontend
    category: Joi.string().max(100).optional(),
    confidence_threshold: Joi.number().min(0).max(1).default(0.7)
});

const updateScriptSchema = Joi.object({
    name: Joi.string().min(3).max(255).optional(),
    type: Joi.string().valid('main_pitch', 'follow_up', 'objection_handling', 'closing').optional(),
    content: Joi.string().min(10).max(5000).optional(),
    description: Joi.string().max(500).optional().allow('', null),
    variables: Joi.object().optional(),
    is_active: Joi.boolean().optional(),
    status: Joi.string().valid('active', 'inactive').optional(), // Accept status field from frontend
    category: Joi.string().max(100).optional(),
    confidence_threshold: Joi.number().min(0).max(1).optional()
});

// Create a new script
router.post('/', authenticateToken, requireRole('admin', 'manager'), async(req, res) => {
    try {
        const { error, value } = scriptSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: error.details.map(d => d.message)
            });
        }

        const { name, type, content, description, variables, status, category, confidence_threshold } = value;

        // Map status to is_active if status is provided
        let is_active = value.is_active;
        if (status !== undefined) {
            is_active = status === 'active';
        }

        const result = await query(`
            INSERT INTO scripts (organization_id, name, type, content, variables, is_active, category, confidence_threshold)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `, [req.organizationId, name, type, content, JSON.stringify(variables), is_active, category, confidence_threshold]);

        const script = result.rows[0];

        logger.info(`Script created: ${script.id} by user ${req.user?.id || 'system'}`);

        res.status(201).json({
            success: true,
            message: 'Script created successfully',
            script: {
                id: script.id,
                name: script.name,
                type: script.type,
                content: script.content,
                description: description || '', // Include description in response
                variables: script.variables,
                isActive: script.is_active,
                status: script.is_active ? 'active' : 'inactive', // Return status for frontend
                category: script.category,
                confidenceThreshold: script.confidence_threshold,
                createdAt: script.created_at,
                updatedAt: script.updated_at,
                usageCount: 0 // Initialize usage count
            }
        });

    } catch (error) {
        logger.error('Script creation error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create script'
        });
    }
});

// Get all scripts
router.get('/', authenticateToken, async(req, res) => {
    try {
        const { type, category, is_active, limit = 50, offset = 0 } = req.query;

        let whereClause = 'WHERE organization_id = $1';
        const params = [req.organizationId];
        let paramCount = 1;

        if (type) {
            paramCount++;
            whereClause += ` AND type = $${paramCount}`;
            params.push(type);
        }

        if (category) {
            paramCount++;
            whereClause += ` AND category = $${paramCount}`;
            params.push(category);
        }

        if (is_active !== undefined) {
            paramCount++;
            whereClause += ` AND is_active = $${paramCount}`;
            params.push(is_active === 'true');
        }

        const result = await query(`
            SELECT *
            FROM scripts
            ${whereClause}
            ORDER BY created_at DESC
            LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
        `, [...params, parseInt(limit), parseInt(offset)]);

        const scripts = result.rows.map(script => ({
            id: script.id,
            name: script.name,
            type: script.type,
            content: script.content,
            description: '', // Add empty description for compatibility
            variables: script.variables,
            isActive: script.is_active,
            status: script.is_active ? 'active' : 'inactive', // Map is_active to status
            category: script.category,
            confidenceThreshold: script.confidence_threshold,
            createdAt: script.created_at,
            updatedAt: script.updated_at,
            usageCount: 0 // Add usage count
        }));

        res.json({
            success: true,
            scripts,
            pagination: {
                limit: parseInt(limit),
                offset: parseInt(offset),
                total: scripts.length
            }
        });

    } catch (error) {
        logger.error('Scripts fetch error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch scripts'
        });
    }
});

// Get single script
router.get('/:id', authenticateToken, async(req, res) => {
    try {
        const { id } = req.params;

        const result = await query(`
            SELECT *
            FROM scripts
            WHERE id = $1 AND organization_id = $2
        `, [id, req.organizationId]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Script not found'
            });
        }

        const script = result.rows[0];

        res.json({
            success: true,
            script: {
                id: script.id,
                name: script.name,
                type: script.type,
                content: script.content,
                description: '', // Add empty description for compatibility
                variables: script.variables,
                isActive: script.is_active,
                status: script.is_active ? 'active' : 'inactive', // Map is_active to status
                category: script.category,
                confidenceThreshold: script.confidence_threshold,
                createdAt: script.created_at,
                updatedAt: script.updated_at,
                usageCount: 0 // Add usage count
            }
        });

    } catch (error) {
        logger.error('Script fetch error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch script'
        });
    }
});

// Update script
router.put('/:id', authenticateToken, requireRole('admin', 'manager'), async(req, res) => {
    try {
        const { id } = req.params;

        const { error, value } = updateScriptSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: error.details.map(d => d.message)
            });
        }

        // Check if script exists
        const existingScript = await query(
            'SELECT id FROM scripts WHERE id = $1 AND organization_id = $2', [id, req.organizationId]
        );

        if (existingScript.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Script not found'
            });
        }

        // Map status to is_active if status is provided
        if (value.status !== undefined) {
            value.is_active = value.status === 'active';
            delete value.status; // Remove status from value so it doesn't get added to SQL
        }

        // Remove description as it's not stored in the database (yet)
        delete value.description;

        // Build update query dynamically
        const updates = [];
        const params = [];
        let paramCount = 0;

        Object.keys(value).forEach(key => {
            if (value[key] !== undefined) {
                paramCount++;
                updates.push(`${key} = $${paramCount}`);
                params.push(key === 'variables' ? JSON.stringify(value[key]) : value[key]);
            }
        });

        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No valid fields to update'
            });
        }

        updates.push(`updated_at = CURRENT_TIMESTAMP`);
        params.push(id, req.organizationId);

        const result = await query(`
            UPDATE scripts
            SET ${updates.join(', ')}
            WHERE id = $${paramCount + 1} AND organization_id = $${paramCount + 2}
            RETURNING *
        `, params);

        const script = result.rows[0];

        logger.info(`Script updated: ${script.id} by user ${req.user?.id || 'system'}`);

        res.json({
            success: true,
            message: 'Script updated successfully',
            script: {
                id: script.id,
                name: script.name,
                type: script.type,
                content: script.content,
                description: '', // Add empty description for compatibility
                variables: script.variables,
                isActive: script.is_active,
                status: script.is_active ? 'active' : 'inactive', // Map is_active to status
                category: script.category,
                confidenceThreshold: script.confidence_threshold,
                createdAt: script.created_at,
                updatedAt: script.updated_at,
                usageCount: 0 // Add usage count
            }
        });

    } catch (error) {
        logger.error('Script update error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update script'
        });
    }
});

// Delete script
router.delete('/:id', authenticateToken, requireRole('admin', 'manager'), async(req, res) => {
    try {
        const { id } = req.params;

        const result = await query(
            'DELETE FROM scripts WHERE id = $1 AND organization_id = $2 RETURNING id', [id, req.organizationId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Script not found'
            });
        }

        logger.info(`Script deleted: ${id} by user ${req.user.id}`);

        res.json({
            success: true,
            message: 'Script deleted successfully'
        });

    } catch (error) {
        logger.error('Script deletion error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete script'
        });
    }
});

// Get script for AI conversation
router.post('/conversation', async(req, res) => {
    try {
        const { call_id, question, context } = req.body;

        if (!call_id || !question) {
            return res.status(400).json({
                success: false,
                message: 'Call ID and question are required'
            });
        }

        // Get call details
        const callResult = await query(`
            SELECT c.*, ct.first_name, ct.last_name, ct.company, cp.name as campaign_name
            FROM calls c
            JOIN contacts ct ON c.contact_id = ct.id
            JOIN campaigns cp ON c.campaign_id = cp.id
            WHERE c.id = $1
        `, [call_id]);

        if (callResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Call not found'
            });
        }

        const call = callResult.rows[0];

        // Get main pitch script for the campaign (use call's organization_id)
        const scriptResult = await query(`
            SELECT content, variables, confidence_threshold
            FROM scripts
            WHERE organization_id = $1 AND type = 'main_pitch' AND is_active = true
            ORDER BY created_at DESC
            LIMIT 1
        `, [call.organization_id]);

        // Query knowledge base for FAQ answers
        const knowledgeResult = await query(`
            SELECT question, answer, confidence
            FROM knowledge_entries
            WHERE organization_id = $1 AND is_active = true
            AND (
                LOWER(question) LIKE ANY($2) OR
                LOWER(answer) LIKE ANY($3)
            )
            ORDER BY confidence DESC
            LIMIT 3
        `, [
            call.organization_id,
            question.toLowerCase().split(' ').filter(w => w.length > 2).map(k => `%${k}%`),
            question.toLowerCase().split(' ').filter(w => w.length > 2).map(k => `%${k}%`)
        ]);

        let response = {
            success: true,
            answer: "I don't have information about that topic. Let me connect you with a human representative.",
            confidence: 0,
            should_fallback: true,
            script_available: scriptResult.rows.length > 0,
            main_script: scriptResult.rows[0] ? scriptResult.rows[0].content : null,
            faq_matches: knowledgeResult.rows.map(row => ({
                question: row.question,
                answer: row.answer,
                confidence: row.confidence
            }))
        };

        // If we have FAQ matches, use the best one
        if (knowledgeResult.rows.length > 0) {
            const bestMatch = knowledgeResult.rows[0];
            response.answer = bestMatch.answer;
            response.confidence = parseFloat(bestMatch.confidence);
            response.should_fallback = parseFloat(bestMatch.confidence) < 0.7;
        }

        // Log conversation event
        await query(`
            INSERT INTO call_events (call_id, event_type, event_data)
            VALUES ($1, $2, $3)
        `, [call_id, 'ai_conversation', JSON.stringify({
            question: question,
            answer: response.answer,
            confidence: response.confidence,
            timestamp: new Date().toISOString()
        })]);

        res.json(response);

    } catch (error) {
        logger.error('Script conversation error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process conversation'
        });
    }
});

// Get script for AI conversation (used by AGI scripts)
router.get('/conversation', async(req, res) => {
    try {
        const { call_id, conversation_type = 'main_pitch' } = req.query;

        if (!call_id) {
            return res.status(400).json({
                success: false,
                message: 'Call ID is required'
            });
        }

        // Get call details
        const callResult = await query(`
            SELECT c.*, camp.name as campaign_name, camp.script_id,
                   ct.first_name, ct.last_name, ct.company, ct.title, ct.phone
            FROM calls c
            LEFT JOIN campaigns camp ON c.campaign_id = camp.id
            LEFT JOIN contacts ct ON c.contact_id = ct.id
            WHERE c.id = $1 AND c.organization_id = $2
        `, [call_id, req.organizationId]);

        if (callResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Call not found'
            });
        }

        const call = callResult.rows[0];
        let script = null;

        // Get script based on conversation type
        if (call.script_id) {
            const scriptResult = await query(`
                SELECT * FROM scripts
                WHERE id = $1 AND organization_id = $2 AND is_active = true
            `, [call.script_id, req.organizationId]);

            if (scriptResult.rows.length > 0) {
                script = scriptResult.rows[0];
            }
        }

        // If no specific script, get default script by type
        if (!script) {
            const defaultScriptResult = await query(`
                SELECT * FROM scripts
                WHERE type = $1 AND organization_id = $2 AND is_active = true
                ORDER BY created_at DESC
                LIMIT 1
            `, [conversation_type, req.organizationId]);

            if (defaultScriptResult.rows.length > 0) {
                script = defaultScriptResult.rows[0];
            }
        }

        // Format response for AGI scripts (backward compatible)
        let mainScript = script ? script.content : 'Hello, this is an AI assistant calling on behalf of our company.';

        // Personalize the script with contact information
        if (call.first_name) {
            mainScript = mainScript.replace(/\{first_name\}/g, call.first_name);
            mainScript = mainScript.replace(/\{name\}/g, call.first_name);
        }
        if (call.last_name) {
            mainScript = mainScript.replace(/\{last_name\}/g, call.last_name);
        }
        if (call.company) {
            mainScript = mainScript.replace(/\{company\}/g, call.company);
        }
        if (call.title) {
            mainScript = mainScript.replace(/\{title\}/g, call.title);
        }

        // Return both old and new format for compatibility
        res.json({
            success: true,
            main_script: mainScript,  // For AGI scripts
            script_content: mainScript,  // Alternative field name
            data: {
                call: call,
                script: script
            },
            contact: {
                first_name: call.first_name,
                last_name: call.last_name,
                company: call.company,
                title: call.title,
                phone: call.phone
            }
        });

    } catch (error) {
        logger.error('Error getting script for conversation:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

module.exports = router;
