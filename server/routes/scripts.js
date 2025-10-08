const express = require('express');
const Joi = require('joi');
const { query } = require('../config/database');
const logger = require('../utils/logger');

const router = express.Router();

// Validation schemas
const scriptSchema = Joi.object({
    name: Joi.string().min(3).max(255).required(),
    type: Joi.string().valid('main_pitch', 'follow_up', 'objection_handling', 'closing').required(),
    content: Joi.string().min(10).max(5000).required(),
    variables: Joi.object().default({}),
    is_active: Joi.boolean().default(true),
    category: Joi.string().max(100).optional(),
    confidence_threshold: Joi.number().min(0).max(1).default(0.7)
});

const updateScriptSchema = Joi.object({
    name: Joi.string().min(3).max(255).optional(),
    type: Joi.string().valid('main_pitch', 'follow_up', 'objection_handling', 'closing').optional(),
    content: Joi.string().min(10).max(5000).optional(),
    variables: Joi.object().optional(),
    is_active: Joi.boolean().optional(),
    category: Joi.string().max(100).optional(),
    confidence_threshold: Joi.number().min(0).max(1).optional()
});

// Create a new script
router.post('/', async(req, res) => {
    try {
        const { error, value } = scriptSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: error.details.map(d => d.message)
            });
        }

        const { name, type, content, variables, is_active, category, confidence_threshold } = value;

        const result = await query(`
            INSERT INTO scripts (organization_id, name, type, content, variables, is_active, category, confidence_threshold)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `, [req.organizationId, name, type, content, JSON.stringify(variables), is_active, category, confidence_threshold]);

        const script = result.rows[0];

        logger.info(`Script created: ${script.id} by user ${req.user.id}`);

        res.status(201).json({
            success: true,
            message: 'Script created successfully',
            script: {
                id: script.id,
                name: script.name,
                type: script.type,
                content: script.content,
                variables: script.variables,
                isActive: script.is_active,
                category: script.category,
                confidenceThreshold: script.confidence_threshold,
                createdAt: script.created_at,
                updatedAt: script.updated_at
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
router.get('/', async(req, res) => {
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
            variables: script.variables,
            isActive: script.is_active,
            category: script.category,
            confidenceThreshold: script.confidence_threshold,
            createdAt: script.created_at,
            updatedAt: script.updated_at
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
router.get('/:id', async(req, res) => {
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
                variables: script.variables,
                isActive: script.is_active,
                category: script.category,
                confidenceThreshold: script.confidence_threshold,
                createdAt: script.created_at,
                updatedAt: script.updated_at
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
router.put('/:id', async(req, res) => {
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

        logger.info(`Script updated: ${script.id} by user ${req.user.id}`);

        res.json({
            success: true,
            message: 'Script updated successfully',
            script: {
                id: script.id,
                name: script.name,
                type: script.type,
                content: script.content,
                variables: script.variables,
                isActive: script.is_active,
                category: script.category,
                confidenceThreshold: script.confidence_threshold,
                updatedAt: script.updated_at
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
router.delete('/:id', async(req, res) => {
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
            WHERE c.id = $1 AND c.organization_id = $2
        `, [call_id, req.organizationId]);

        if (callResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Call not found'
            });
        }

        const call = callResult.rows[0];

        // Get main pitch script for the campaign
        const scriptResult = await query(`
            SELECT content, variables, confidence_threshold
            FROM scripts
            WHERE organization_id = $1 AND type = 'main_pitch' AND is_active = true
            ORDER BY created_at DESC
            LIMIT 1
        `, [req.organizationId]);

        // Query knowledge base for FAQ answers
        const knowledgeResult = await query(`
            SELECT question, answer, confidence
            FROM knowledge_base
            WHERE organization_id = $1 AND is_active = true
            AND (
                LOWER(question) LIKE ANY($2) OR
                LOWER(answer) LIKE ANY($3)
            )
            ORDER BY confidence DESC
            LIMIT 3
        `, [
            req.organizationId,
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

module.exports = router;