const express = require('express');
const Joi = require('joi');
const { query } = require('../config/database');
const logger = require('../utils/logger');
const { authenticateToken } = require('../middleware/auth');
const ttsService = require('../services/tts');

const router = express.Router();

// Validation schemas
const generateTTSSchema = Joi.object({
    text: Joi.string().min(1).max(5000).required(),
    voice: Joi.string().required(),
    volume: Joi.number().min(0).max(1).default(0.8),
    speed: Joi.number().min(0.5).max(2.0).default(1.0),
    pitch: Joi.number().min(-1).max(1).default(0),
    format: Joi.string().valid('mp3', 'wav', 'ogg').default('mp3')
});

const presetSchema = Joi.object({
    name: Joi.string().min(1).max(100).required(),
    description: Joi.string().max(500).optional(),
    voice: Joi.string().required(),
    volume: Joi.number().min(0).max(100).required(),
    speed: Joi.number().min(0.5).max(2.0).required(),
    pitch: Joi.number().min(-20).max(20).required()
});

// Get available voices
router.get('/voices', authenticateToken, async(req, res) => {
    try {
        const voices = await ttsService.getAvailableVoices();

        res.json({
            success: true,
            data: {
                voices
            }
        });
    } catch (error) {
        logger.error('TTS voices fetch error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch available voices'
        });
    }
});

// Generate TTS audio
router.post('/generate', authenticateToken, async(req, res) => {
    try {
        const { error, value } = generateTTSSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: error.details.map(detail => detail.message)
            });
        }

        const { text, voice, volume, speed, pitch, format } = value;

        // Generate TTS audio
        const result = await ttsService.generateSpeech({
            text,
            voice,
            volume,
            speed,
            pitch,
            format,
            organizationId: req.organizationId
        });

        if (result.success) {
            res.json({
                success: true,
                data: {
                    audioUrl: result.audioUrl,
                    duration: result.duration,
                    size: result.size,
                    format: result.format
                }
            });
        } else {
            res.status(500).json({
                success: false,
                message: result.error || 'Failed to generate speech'
            });
        }

    } catch (error) {
        logger.error('TTS generation error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate speech'
        });
    }
});

// Get voice presets
router.get('/presets', authenticateToken, async(req, res) => {
    try {
        const result = await query(`
            SELECT id, name, description, voice, volume, speed, pitch, created_at
            FROM voice_presets
            WHERE organization_id = $1
            ORDER BY created_at DESC
        `, [req.organizationId]);

        const presets = result.rows.map(preset => ({
            id: preset.id,
            name: preset.name,
            description: preset.description,
            voice: preset.voice,
            volume: preset.volume,
            speed: preset.speed,
            pitch: preset.pitch,
            createdAt: preset.created_at
        }));

        res.json({
            success: true,
            data: {
                presets
            }
        });

    } catch (error) {
        logger.error('TTS presets fetch error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch voice presets'
        });
    }
});

// Create voice preset
router.post('/presets', authenticateToken, async(req, res) => {
    try {
        const { error, value } = presetSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: error.details.map(detail => detail.message)
            });
        }

        const { name, description, voice, volume, speed, pitch } = value;

        // Check if preset with same name exists
        const existingResult = await query(`
            SELECT id FROM voice_presets
            WHERE name = $1 AND organization_id = $2
        `, [name, req.organizationId]);

        if (existingResult.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'Preset with this name already exists'
            });
        }

        // Create preset
        const result = await query(`
            INSERT INTO voice_presets (name, description, voice, volume, speed, pitch, organization_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id, name, description, voice, volume, speed, pitch, created_at
        `, [name, description, voice, volume, speed, pitch, req.organizationId]);

        const preset = result.rows[0];

        logger.info(`Voice preset created: ${preset.id} by organization ${req.organizationId}`);

        res.status(201).json({
            success: true,
            message: 'Voice preset created successfully',
            data: {
                preset: {
                    id: preset.id,
                    name: preset.name,
                    description: preset.description,
                    voice: preset.voice,
                    volume: preset.volume,
                    speed: preset.speed,
                    pitch: preset.pitch,
                    createdAt: preset.created_at
                }
            }
        });

    } catch (error) {
        logger.error('TTS preset creation error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create voice preset'
        });
    }
});

// Update voice preset
router.put('/presets/:id', authenticateToken, async(req, res) => {
    try {
        const { id } = req.params;
        const { error, value } = presetSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: error.details.map(detail => detail.message)
            });
        }

        const { name, description, voice, volume, speed, pitch } = value;

        // Check if preset exists and belongs to organization
        const existingResult = await query(`
            SELECT id FROM voice_presets
            WHERE id = $1 AND organization_id = $2
        `, [id, req.organizationId]);

        if (existingResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Voice preset not found'
            });
        }

        // Check if another preset with same name exists
        const duplicateResult = await query(`
            SELECT id FROM voice_presets
            WHERE name = $1 AND organization_id = $2 AND id != $3
        `, [name, req.organizationId, id]);

        if (duplicateResult.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'Preset with this name already exists'
            });
        }

        // Update preset
        const result = await query(`
            UPDATE voice_presets
            SET name = $1, description = $2, voice = $3, volume = $4, speed = $5, pitch = $6, updated_at = CURRENT_TIMESTAMP
            WHERE id = $7 AND organization_id = $8
            RETURNING id, name, description, voice, volume, speed, pitch, updated_at
        `, [name, description, voice, volume, speed, pitch, id, req.organizationId]);

        const preset = result.rows[0];

        logger.info(`Voice preset updated: ${preset.id} by organization ${req.organizationId}`);

        res.json({
            success: true,
            message: 'Voice preset updated successfully',
            data: {
                preset: {
                    id: preset.id,
                    name: preset.name,
                    description: preset.description,
                    voice: preset.voice,
                    volume: preset.volume,
                    speed: preset.speed,
                    pitch: preset.pitch,
                    updatedAt: preset.updated_at
                }
            }
        });

    } catch (error) {
        logger.error('TTS preset update error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update voice preset'
        });
    }
});

// Delete voice preset
router.delete('/presets/:id', authenticateToken, async(req, res) => {
    try {
        const { id } = req.params;

        // Check if preset exists and belongs to organization
        const existingResult = await query(`
            SELECT id FROM voice_presets
            WHERE id = $1 AND organization_id = $2
        `, [id, req.organizationId]);

        if (existingResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Voice preset not found'
            });
        }

        // Delete preset
        await query(`
            DELETE FROM voice_presets
            WHERE id = $1 AND organization_id = $2
        `, [id, req.organizationId]);

        logger.info(`Voice preset deleted: ${id} by organization ${req.organizationId}`);

        res.json({
            success: true,
            message: 'Voice preset deleted successfully'
        });

    } catch (error) {
        logger.error('TTS preset deletion error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete voice preset'
        });
    }
});

module.exports = router;