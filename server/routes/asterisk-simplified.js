const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

// Import simplified services
const piperTTS = require('../services/piper-tts');
const voskSTT = require('../services/vosk-stt');

const router = express.Router();

// Setup multer for audio uploads
const uploadDir = path.join(__dirname, '../uploads/audio');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
    dest: uploadDir,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB max
});

/**
 * SIMPLIFIED ASTERISK ROUTES
 * Only essential endpoints for automated calling
 */

// Generate TTS using Piper (human-like voice)
router.post('/tts/generate', async (req, res) => {
    try {
        const { text, voice = 'amy', speed = 1.0 } = req.body;

        if (!text) {
            return res.status(400).json({
                success: false,
                message: 'Text is required'
            });
        }

        logger.info(`Piper TTS request: ${text.substring(0, 50)}...`);

        // Generate with Piper
        const result = await piperTTS.generateSpeech(text, { voice, speed });

        res.json({
            success: true,
            audio_url: result.audioUrl,
            cached: result.cached
        });

    } catch (error) {
        logger.error('Piper TTS generation error:', error);

        // Fallback response
        res.json({
            success: false,
            message: 'TTS generation failed',
            error: error.message
        });
    }
});

// Speech transcription using Vosk
router.post('/speech/transcribe', upload.single('audio'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'Audio file is required'
            });
        }

        const audioPath = req.file.path;
        logger.info(`Vosk STT request: ${req.file.filename}`);

        // Transcribe with Vosk
        const result = await voskSTT.transcribe(audioPath);

        // Clean up audio file
        fs.unlinkSync(audioPath);

        if (result.success && result.text) {
            logger.info(`Transcribed: "${result.text.substring(0, 100)}..."`);

            res.json({
                success: true,
                text: result.text,
                confidence: result.confidence
            });
        } else {
            // No speech detected
            res.json({
                success: true,
                text: '',
                confidence: 0
            });
        }

    } catch (error) {
        logger.error('Vosk STT error:', error);

        // Clean up on error
        if (req.file && req.file.path && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        res.json({
            success: false,
            message: 'Transcription failed',
            text: '',
            confidence: 0
        });
    }
});

// Serve audio files
router.get('/audio/:filename', (req, res) => {
    try {
        const { filename } = req.params;
        const filepath = path.join(__dirname, '../../audio/piper', filename);

        if (!fs.existsSync(filepath)) {
            return res.status(404).json({
                success: false,
                message: 'Audio file not found'
            });
        }

        res.setHeader('Content-Type', 'audio/wav');
        res.setHeader('Content-Length', fs.statSync(filepath).size);

        const stream = fs.createReadStream(filepath);
        stream.pipe(res);

    } catch (error) {
        logger.error('Audio serving error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to serve audio'
        });
    }
});

// Call started notification
router.post('/call-started', async (req, res) => {
    try {
        const { call_id, contact_phone, campaign_id, timestamp } = req.body;

        logger.info(`📞 Call started: ${call_id} to ${contact_phone}`);

        const { query } = require('../config/database');
        const WebSocketBroadcaster = require('../services/websocket-broadcaster');

        // Update call status to in_progress
        await query(`
            UPDATE calls
            SET status = 'in_progress',
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
        `, [call_id]);

        // Get call data for broadcasting
        const callData = await query(`
            SELECT c.*, ct.first_name, ct.last_name, cp.name as campaign_name
            FROM calls c
            JOIN contacts ct ON c.contact_id = ct.id
            JOIN campaigns cp ON c.campaign_id = cp.id
            WHERE c.id = $1
        `, [call_id]);

        if (callData.rows[0]) {
            const call = callData.rows[0];

            // Broadcast call started event
            WebSocketBroadcaster.broadcastCallStarted(call.organization_id, {
                callId: call_id,
                contactId: call.contact_id,
                campaignId: campaign_id,
                phoneNumber: contact_phone,
                contactName: `${call.first_name} ${call.last_name}`,
                campaignName: call.campaign_name,
                automated: true
            });

            // Log event
            await query(`
                INSERT INTO call_events (call_id, event_type, event_data)
                VALUES ($1, $2, $3)
            `, [call_id, 'call_started', JSON.stringify({
                contact_phone,
                campaign_id,
                timestamp: timestamp || new Date().toISOString()
            })]);
        }

        res.json({ success: true });

    } catch (error) {
        logger.error('Call started error:', error);
        res.json({ success: false, error: error.message });
    }
});

// Call ended notification
router.post('/call-ended', async (req, res) => {
    try {
        const { call_id, reason, turns, timestamp } = req.body;

        logger.info(`📴 Call ended: ${call_id}, Reason: ${reason}, Turns: ${turns}`);

        const { query } = require('../config/database');
        const WebSocketBroadcaster = require('../services/websocket-broadcaster');

        // Get call data before finalizing
        const callData = await query(`
            SELECT * FROM calls WHERE id = $1
        `, [call_id]);

        if (callData.rows[0]) {
            const call = callData.rows[0];
            const duration = Math.floor((Date.now() - new Date(call.created_at).getTime()) / 1000);

            // Update call as completed if not already
            await query(`
                UPDATE calls
                SET
                    status = CASE WHEN status != 'completed' THEN 'completed' ELSE status END,
                    duration = COALESCE(duration, $1),
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $2
            `, [duration, call_id]);

            // Broadcast call ended
            WebSocketBroadcaster.broadcastCallEnded(call.organization_id, call_id, {
                status: 'completed',
                outcome: call.outcome,
                duration: duration,
                turns: turns,
                reason: reason
            });

            // Log event
            await query(`
                INSERT INTO call_events (call_id, event_type, event_data)
                VALUES ($1, $2, $3)
            `, [call_id, 'call_ended', JSON.stringify({
                reason,
                turns,
                duration,
                timestamp: timestamp || new Date().toISOString()
            })]);
        }

        res.json({ success: true });

    } catch (error) {
        logger.error('Call ended error:', error);
        res.json({ success: false, error: error.message });
    }
});

// Call error notification
router.post('/call-error', async (req, res) => {
    try {
        const { call_id, error: errorMessage, timestamp } = req.body;

        logger.error(`❌ Call error: ${call_id} - ${errorMessage}`);

        const { query } = require('../config/database');

        // Update call status to failed
        await query(`
            UPDATE calls
            SET status = 'failed',
                outcome = 'failed',
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
        `, [call_id]);

        // Log error event
        await query(`
            INSERT INTO call_events (call_id, event_type, event_data)
            VALUES ($1, $2, $3)
        `, [call_id, 'call_error', JSON.stringify({
            error: errorMessage,
            timestamp: timestamp || new Date().toISOString()
        })]);

        res.json({ success: true });

    } catch (error) {
        logger.error('Call error logging failed:', error);
        res.json({ success: false, error: error.message });
    }
});

// New endpoint: Conversation update (for real-time conversation logging)
router.post('/conversation-update', async (req, res) => {
    try {
        const { call_id, user_input, ai_response, turn, metadata } = req.body;

        logger.info(`💬 Conversation update: ${call_id}, Turn: ${turn}`);

        const { query } = require('../config/database');
        const WebSocketBroadcaster = require('../services/websocket-broadcaster');

        // Store conversation turn
        const eventData = {
            user_input,
            ai_response,
            turn,
            timestamp: new Date().toISOString(),
            ...metadata
        };

        await query(`
            INSERT INTO call_events (call_id, event_type, event_data)
            VALUES ($1, $2, $3)
        `, [call_id, 'ai_conversation', JSON.stringify(eventData)]);

        // Get organization_id for broadcasting
        const callData = await query(`
            SELECT organization_id FROM calls WHERE id = $1
        `, [call_id]);

        if (callData.rows[0]) {
            // Broadcast conversation turn
            WebSocketBroadcaster.broadcastConversationTurn(
                callData.rows[0].organization_id,
                call_id,
                eventData
            );
        }

        res.json({ success: true });

    } catch (error) {
        logger.error('Conversation update error:', error);
        res.json({ success: false, error: error.message });
    }
});

module.exports = router;
