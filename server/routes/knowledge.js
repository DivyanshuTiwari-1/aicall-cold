const express = require('express');
const Joi = require('joi');
const { query } = require('../config/database');
const logger = require('../utils/logger');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Validation schemas
const knowledgeSchema = Joi.object({
    question: Joi.string().min(5).max(500).required(),
    answer: Joi.string().min(10).max(2000).required(),
    category: Joi.string().max(100).optional(),
    confidence: Joi.number().min(0).max(1).default(1.0)
});

const querySchema = Joi.object({
    question: Joi.string().min(5).max(500).required()
});

// Get knowledge base categories (MUST be before parameterized routes)
router.get('/categories', authenticateToken, requireRole('admin', 'manager', 'agent'), async(req, res) => {
    try {
        const categoriesQuery = `
            SELECT DISTINCT category, COUNT(*) as entry_count
            FROM knowledge_entries
            WHERE organization_id = $1
            GROUP BY category
            ORDER BY category
        `;

        const result = await query(categoriesQuery, [req.user.organizationId]);

        res.json({
            success: true,
            categories: result.rows
        });
    } catch (error) {
        logger.error('Error fetching knowledge categories:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch knowledge categories'
        });
    }
});

// Get knowledge base entries (MUST be before parameterized routes)
router.get('/entries', authenticateToken, requireRole('admin', 'manager', 'agent'), async(req, res) => {
    try {
        const { search = '', category = '', limit = 50, offset = 0 } = req.query;

        let whereClause = 'WHERE organization_id = $1';
        let params = [req.user.organizationId];
        let paramCount = 1;

        if (search) {
            paramCount++;
            whereClause += ` AND (question ILIKE $${paramCount} OR answer ILIKE $${paramCount})`;
            params.push(`%${search}%`);
        }

        if (category) {
            paramCount++;
            whereClause += ` AND category = $${paramCount}`;
            params.push(category);
        }

        const entriesQuery = `
            SELECT id, question, answer, category, confidence, created_at, updated_at
            FROM knowledge_entries
            ${whereClause}
            ORDER BY created_at DESC
            LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
        `;

        params.push(parseInt(limit), parseInt(offset));

        const result = await query(entriesQuery, params);

        res.json({
            success: true,
            entries: result.rows,
            pagination: {
                limit: parseInt(limit),
                offset: parseInt(offset),
                total: result.rows.length
            }
        });
    } catch (error) {
        logger.error('Error fetching knowledge entries:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch knowledge entries'
        });
    }
});

// Query knowledge base
router.post('/query', authenticateToken, async(req, res) => {
    try {
        const { error, value } = querySchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: error.details.map(d => d.message)
            });
        }

        const { question } = value;

        // Simple keyword-based search (in production, use vector search or NLP)
        const keywords = question.toLowerCase().split(' ').filter(word => word.length > 2);
        const searchPattern = keywords.map(() => '%' + '?' + '%').join('');

        const result = await query(`
      SELECT id, question, answer, category, confidence
      FROM knowledge_entries
      WHERE organization_id = $1 AND is_active = true
      AND (
        LOWER(question) LIKE ANY($2) OR
        LOWER(answer) LIKE ANY($3)
      )
      ORDER BY confidence DESC,
        CASE
          WHEN LOWER(question) LIKE ANY($2) THEN 1
          ELSE 2
        END
      LIMIT 5
    `, [
            req.organizationId,
            keywords.map(k => `%${k}%`),
            keywords.map(k => `%${k}%`)
        ]);

        // Log the query
        const callId = req.body.callId || null;
        await query(`
            INSERT INTO knowledge_queries (call_id, query_text, organization_id)
            VALUES ($1, $2, $3)
        `, [callId, question, req.organizationId]);

        if (result.rows.length === 0) {
            return res.json({
                success: true,
                answer: "I don't have information about that topic. Let me connect you with a human representative.",
                confidence: 0,
                should_fallback: true,
                suggestions: []
            });
        }

        const bestMatch = result.rows[0];
        const suggestions = result.rows.slice(1).map(row => ({
            question: row.question,
            answer: row.answer,
            category: row.category
        }));

        // Update usage statistics for matched entries
        for (const row of result.rows) {
            await query(`
                UPDATE knowledge_entries
                SET usage_count = usage_count + 1, last_used_at = CURRENT_TIMESTAMP
                WHERE id = $1
            `, [row.id]);
        }

        // Log the matched entry
        await query(`
            UPDATE knowledge_queries
            SET matched_entry_id = $1, confidence_score = $2
            WHERE call_id = $3 AND query_text = $4
            ORDER BY created_at DESC LIMIT 1
        `, [bestMatch.id, bestMatch.confidence, callId, question]);

        res.json({
            success: true,
            answer: bestMatch.answer,
            confidence: parseFloat(bestMatch.confidence),
            should_fallback: parseFloat(bestMatch.confidence) < 0.7,
            category: bestMatch.category,
            suggestions
        });

    } catch (error) {
        logger.error('Knowledge query error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to query knowledge base'
        });
    }
});

// Add knowledge base entry
router.post('/entries', authenticateToken, requireRole('admin', 'manager'), async(req, res) => {
    try {
        const { error, value } = knowledgeSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: error.details.map(d => d.message)
            });
        }

        const { question, answer, category, confidence } = value;

        const result = await query(`
      INSERT INTO knowledge_entries (organization_id, question, answer, category, confidence)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [req.organizationId, question, answer, category, confidence]);

        const knowledgeEntry = result.rows[0];

        logger.info(`Knowledge entry added: ${knowledgeEntry.id} by user ${req.user.id}`);

        res.status(201).json({
            success: true,
            message: 'Knowledge base entry added successfully',
            entry: {
                id: knowledgeEntry.id,
                question: knowledgeEntry.question,
                answer: knowledgeEntry.answer,
                category: knowledgeEntry.category,
                confidence: knowledgeEntry.confidence,
                isActive: knowledgeEntry.is_active,
                createdAt: knowledgeEntry.created_at
            }
        });

    } catch (error) {
        logger.error('Knowledge entry creation error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to add knowledge base entry'
        });
    }
});

// Get single knowledge base entry by ID
router.get('/entries/:id', authenticateToken, requireRole('admin', 'manager', 'agent'), async(req, res) => {
    try {
        const { id } = req.params;

        const result = await query(`
            SELECT id, question, answer, category, confidence, is_active, created_at, updated_at, usage_count, last_used_at
            FROM knowledge_entries
            WHERE id = $1 AND organization_id = $2
        `, [id, req.organizationId]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Knowledge base entry not found'
            });
        }

        const entry = result.rows[0];

        res.json({
            success: true,
            entry: {
                id: entry.id,
                question: entry.question,
                answer: entry.answer,
                category: entry.category,
                confidence: entry.confidence,
                isActive: entry.is_active,
                createdAt: entry.created_at,
                updatedAt: entry.updated_at,
                usageCount: entry.usage_count,
                lastUsedAt: entry.last_used_at
            }
        });

    } catch (error) {
        logger.error('Knowledge entry fetch error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch knowledge base entry'
        });
    }
});

// Get knowledge base entries (list)
router.get('/', authenticateToken, requireRole('admin', 'manager', 'agent'), async(req, res) => {
    try {
        const { category, limit = 50, offset = 0, search } = req.query;

        let whereClause = 'WHERE organization_id = $1';
        const params = [req.organizationId];
        let paramCount = 1;

        if (category) {
            paramCount++;
            whereClause += ` AND category = $${paramCount}`;
            params.push(category);
        }

        if (search) {
            paramCount++;
            whereClause += ` AND (question ILIKE $${paramCount} OR answer ILIKE $${paramCount})`;
            params.push(`%${search}%`);
        }

        const result = await query(`
      SELECT *
      FROM knowledge_entries
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `, [...params, parseInt(limit), parseInt(offset)]);

        const entries = result.rows.map(entry => ({
            id: entry.id,
            question: entry.question,
            answer: entry.answer,
            category: entry.category,
            confidence: entry.confidence,
            isActive: entry.is_active,
            createdAt: entry.created_at,
            updatedAt: entry.updated_at
        }));

        res.json({
            success: true,
            entries,
            pagination: {
                limit: parseInt(limit),
                offset: parseInt(offset),
                total: entries.length
            }
        });

    } catch (error) {
        logger.error('Knowledge base fetch error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch knowledge base entries'
        });
    }
});

// Update knowledge base entry
router.put('/entries/:id', authenticateToken, requireRole('admin', 'manager'), async(req, res) => {
    try {
        const { id } = req.params;
        const updateSchema = Joi.object({
            question: Joi.string().min(5).max(500).optional(),
            answer: Joi.string().min(10).max(2000).optional(),
            category: Joi.string().max(100).optional(),
            confidence: Joi.number().min(0).max(1).optional(),
            is_active: Joi.boolean().optional()
        });

        const { error, value } = updateSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: error.details.map(d => d.message)
            });
        }

        // Check if entry exists
        const existingEntry = await query(
            'SELECT id FROM knowledge_entries WHERE id = $1 AND organization_id = $2', [id, req.organizationId]
        );

        if (existingEntry.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Knowledge base entry not found'
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
                params.push(value[key]);
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
      UPDATE knowledge_entries
      SET ${updates.join(', ')}
      WHERE id = $${paramCount + 1} AND organization_id = $${paramCount + 2}
      RETURNING *
    `, params);

        const entry = result.rows[0];

        logger.info(`Knowledge entry updated: ${entry.id} by user ${req.user.id}`);

        res.json({
            success: true,
            message: 'Knowledge base entry updated successfully',
            entry: {
                id: entry.id,
                question: entry.question,
                answer: entry.answer,
                category: entry.category,
                confidence: entry.confidence,
                isActive: entry.is_active,
                updatedAt: entry.updated_at
            }
        });

    } catch (error) {
        logger.error('Knowledge entry update error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update knowledge base entry'
        });
    }
});

// Delete knowledge base entry
router.delete('/entries/:id', authenticateToken, requireRole('admin', 'manager'), async(req, res) => {
    try {
        const { id } = req.params;

        const result = await query(
            'DELETE FROM knowledge_entries WHERE id = $1 AND organization_id = $2 RETURNING id', [id, req.organizationId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Knowledge base entry not found'
            });
        }

        logger.info(`Knowledge entry deleted: ${id} by user ${req.user.id}`);

        res.json({
            success: true,
            message: 'Knowledge base entry deleted successfully'
        });

    } catch (error) {
        logger.error('Knowledge entry deletion error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete knowledge base entry'
        });
    }
});

module.exports = router;
