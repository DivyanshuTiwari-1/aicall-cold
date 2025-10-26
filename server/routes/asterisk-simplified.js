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
        const { call_id, contact_phone, campaign_id } = req.body;
        
        logger.info(`Call started: ${call_id} to ${contact_phone}`);

        // Update call status in database (handled by queue service)
        res.json({ success: true });

    } catch (error) {
        logger.error('Call started error:', error);
        res.json({ success: false });
    }
});

// Call ended notification
router.post('/call-ended', async (req, res) => {
    try {
        const { call_id, reason, turns } = req.body;
        
        logger.info(`Call ended: ${call_id}, Reason: ${reason}, Turns: ${turns}`);

        res.json({ success: true });

    } catch (error) {
        logger.error('Call ended error:', error);
        res.json({ success: false });
    }
});

// Call error notification
router.post('/call-error', async (req, res) => {
    try {
        const { call_id, error } = req.body;
        
        logger.error(`Call error: ${call_id} - ${error}`);

        res.json({ success: true });

    } catch (error) {
        logger.error('Call error logging failed:', error);
        res.json({ success: false });
    }
});

module.exports = router;






