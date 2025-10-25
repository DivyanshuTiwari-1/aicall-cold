const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { query } = require('../config/database');
const logger = require('../utils/logger');
const ttsService = require('../services/tts');

const router = express.Router();

// Middleware to handle organization ID for AGI scripts
router.use(async (req, res, next) => {
    // AGI scripts don't have authentication
    // Try to get org ID from call_id in request
    if (!req.organizationId) {
        const call_id = req.body?.call_id || req.query?.call_id || req.params?.call_id;
        if (call_id) {
            try {
                // Look up organization_id from the call
                const result = await query('SELECT organization_id FROM calls WHERE id = $1', [call_id]);
                if (result.rows.length > 0) {
                    req.organizationId = result.rows[0].organization_id;
                    logger.debug(`Found organization_id ${req.organizationId} for call ${call_id}`);
                } else {
                    // Call not found, try to get from first organization in system
                    logger.warn(`Call ${call_id} not found, using fallback organization`);
                    const orgResult = await query('SELECT id FROM organizations LIMIT 1');
                    req.organizationId = orgResult.rows[0]?.id || 'default-org';
                }
            } catch (error) {
                logger.warn('Could not look up organization_id from call:', error.message);
                // Fallback to first organization
                try {
                    const orgResult = await query('SELECT id FROM organizations LIMIT 1');
                    req.organizationId = orgResult.rows[0]?.id || 'default-org';
                } catch (orgError) {
                    req.organizationId = 'default-org';
                }
            }
        } else {
            // No call_id provided, use first organization as fallback
            try {
                const orgResult = await query('SELECT id FROM organizations LIMIT 1');
                req.organizationId = orgResult.rows[0]?.id || 'default-org';
            } catch (error) {
                req.organizationId = 'default-org';
            }
        }
    }
    next();
});

// Configure multer for audio file uploads
const upload = multer({
    dest: '/tmp/audio-uploads/',
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('audio/')) {
            cb(null, true);
        } else {
            cb(new Error('Only audio files are allowed'), false);
        }
    }
});

// Ensure upload directory exists
const uploadDir = '/tmp/audio-uploads';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Call started notification
router.post('/call-started', async(req, res) => {
    try {
        const { call_id, contact_phone, campaign_id, timestamp } = req.body;

        logger.info(`Call started - ID: ${call_id}, Phone: ${contact_phone}, Campaign: ${campaign_id}`);

        // Update call status in database
        await query(`
            UPDATE calls
            SET status = 'in_progress', updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
        `, [call_id]);

        // Log call event
        await query(`
            INSERT INTO call_events (call_id, event_type, event_data)
            VALUES ($1, $2, $3)
        `, [call_id, 'call_started', JSON.stringify({
            contact_phone,
            campaign_id,
            timestamp,
            status: 'in_progress'
        })]);

        res.json({ success: true, message: 'Call started notification received' });

    } catch (error) {
        logger.error('Call started error:', error);
        res.status(500).json({ success: false, message: 'Failed to process call started' });
    }
});

// Call ended notification
router.post('/call-ended', async(req, res) => {
    try {
        const { call_id, reason, turns, timestamp } = req.body;

        logger.info(`Call ended - ID: ${call_id}, Reason: ${reason}, Turns: ${turns}`);

        // Get call start time to calculate duration
        const callData = await query(`
            SELECT created_at, organization_id
            FROM calls
            WHERE id = $1
        `, [call_id]);

        if (callData.rows.length > 0) {
            const startTime = new Date(callData.rows[0].created_at);
            const endTime = new Date(timestamp || Date.now());
            const durationSeconds = Math.floor((endTime - startTime) / 1000);

            // Calculate cost based on actual duration
            const TELNYX_RATE_PER_MINUTE = 0.011;
            const TELNYX_TTS_RATE_PER_CHAR = 0.000003;
            const estimatedChars = (turns || 0) * 200; // ~200 chars per conversation turn

            const callCost = (durationSeconds / 60) * TELNYX_RATE_PER_MINUTE;
            const ttsCost = estimatedChars * TELNYX_TTS_RATE_PER_CHAR;
            const totalCost = callCost + ttsCost;

            // Determine outcome based on turns and reason
            let outcome = 'completed';
            if (reason === 'no_answer' || turns === 0) {
                outcome = 'no_answer';
            } else if (reason === 'busy') {
                outcome = 'busy';
            } else if (turns >= 3) {
                outcome = 'interested'; // Had a conversation
            }

            // Get aggregated transcript from call_events
            const transcriptResult = await query(`
                SELECT event_data
                FROM call_events
                WHERE call_id = $1 AND event_type = 'ai_conversation'
                ORDER BY timestamp ASC
            `, [call_id]);

            let fullTranscript = '';
            transcriptResult.rows.forEach(row => {
                const data = row.event_data;
                if (data.user_input) {
                    fullTranscript += `Customer: ${data.user_input}\n`;
                }
                if (data.ai_response) {
                    fullTranscript += `AI: ${data.ai_response}\n`;
                }
            });

            // Update call with final data (only if Stasis app hasn't already updated it)
            // Note: Stasis app (ChannelDestroyed) handles the primary update
            // This is a fallback in case the channel event doesn't fire
            await query(`
                UPDATE calls
                SET
                    status = 'completed',
                    outcome = COALESCE($1, outcome),
                    duration = COALESCE($2, duration),
                    cost = COALESCE($3, cost),
                    transcript = COALESCE($4, transcript),
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $5 AND status != 'completed'
            `, [outcome, durationSeconds, totalCost, fullTranscript || null, call_id]);

            // Update contact status based on call outcome
            await query(`
                UPDATE contacts
                SET
                    status = CASE
                        WHEN $2 IN ('completed', 'interested', 'scheduled') THEN 'contacted'
                        WHEN $2 IN ('no_answer', 'busy') THEN 'retry'
                        ELSE status
                    END,
                    last_contacted = CURRENT_TIMESTAMP
                WHERE id = (SELECT contact_id FROM calls WHERE id = $1)
            `, [call_id, outcome]);

            logger.info(`✅ Call ${call_id} completed - Duration: ${durationSeconds}s, Cost: $${totalCost.toFixed(4)}, Outcome: ${outcome}`);
        }

        // Log call event
        await query(`
            INSERT INTO call_events (call_id, event_type, event_data)
            VALUES ($1, $2, $3)
        `, [call_id, 'call_ended', JSON.stringify({
            reason,
            turns,
            timestamp,
            status: 'completed'
        })]);

        res.json({ success: true, message: 'Call ended notification received' });

    } catch (error) {
        logger.error('Call ended error:', error);
        res.status(500).json({ success: false, message: 'Failed to process call ended' });
    }
});

// Call completed with full data
router.post('/call-completed', async(req, res) => {
    try {
        const {
            call_id,
            status,
            outcome,
            duration,
            dial_status,
            hangup_cause,
            call_state,
            timestamp
        } = req.body;

        logger.info(`Call completed - ID: ${call_id}, Status: ${status}, Outcome: ${outcome}, Duration: ${duration}s`);

        // Update call with completion data
        await query(`
            UPDATE calls
            SET
                status = $1,
                outcome = $2,
                duration = $3,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $4
        `, [status, outcome, duration, call_id]);

        // Log call completion event
        await query(`
            INSERT INTO call_events (call_id, event_type, event_data)
            VALUES ($1, $2, $3)
        `, [call_id, 'call_completed', JSON.stringify({
            status,
            outcome,
            duration,
            dial_status,
            hangup_cause,
            call_state,
            timestamp
        })]);

        res.json({ success: true, message: 'Call completion data received' });

    } catch (error) {
        logger.error('Call completed error:', error);
        res.status(500).json({ success: false, message: 'Failed to process call completion' });
    }
});

// Call error notification
router.post('/call-error', async(req, res) => {
    try {
        const { call_id, error, timestamp } = req.body;

        logger.error(`Call error - ID: ${call_id}, Error: ${error}`);

        // Update call status to failed
        await query(`
            UPDATE calls
            SET status = 'failed', updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
        `, [call_id]);

        // Log error event
        await query(`
            INSERT INTO call_events (call_id, event_type, event_data)
            VALUES ($1, $2, $3)
        `, [call_id, 'call_error', JSON.stringify({
            error,
            timestamp,
            status: 'failed'
        })]);

        res.json({ success: true, message: 'Call error logged' });

    } catch (error) {
        logger.error('Call error logging failed:', error);
        res.status(500).json({ success: false, message: 'Failed to log call error' });
    }
});

// Call event logging
router.post('/call-event', async(req, res) => {
    try {
        const { call_id, event_type, event_data, timestamp } = req.body;

        logger.info(`Call event - ID: ${call_id}, Type: ${event_type}`);

        // Log the event
        await query(`
            INSERT INTO call_events (call_id, event_type, event_data)
            VALUES ($1, $2, $3)
        `, [call_id, event_type, JSON.stringify({
            ...event_data,
            timestamp
        })]);

        res.json({ success: true, message: 'Call event logged' });

    } catch (error) {
        logger.error('Call event logging error:', error);
        res.status(500).json({ success: false, message: 'Failed to log call event' });
    }
});

// Inbound call notification
router.post('/inbound-call', async(req, res) => {
    try {
        const { caller_id, caller_name, timestamp, call_type } = req.body;

        logger.info(`Inbound call - Caller ID: ${caller_id}, Name: ${caller_name}`);

        // Log inbound call event
        await query(`
            INSERT INTO call_events (call_id, event_type, event_data)
            VALUES ($1, $2, $3)
        `, [caller_id, 'inbound_call', JSON.stringify({
            caller_id,
            caller_name,
            call_type,
            timestamp
        })]);

        res.json({ success: true, message: 'Inbound call logged' });

    } catch (error) {
        logger.error('Inbound call error:', error);
        res.status(500).json({ success: false, message: 'Failed to log inbound call' });
    }
});

// Inbound call ended
router.post('/inbound-call-ended', async(req, res) => {
    try {
        const { caller_id, caller_name, turns, timestamp } = req.body;

        logger.info(`Inbound call ended - Caller ID: ${caller_id}, Turns: ${turns}`);

        // Log inbound call end event
        await query(`
            INSERT INTO call_events (call_id, event_type, event_data)
            VALUES ($1, $2, $3)
        `, [caller_id, 'inbound_call_ended', JSON.stringify({
            caller_id,
            caller_name,
            turns,
            timestamp
        })]);

        res.json({ success: true, message: 'Inbound call end logged' });

    } catch (error) {
        logger.error('Inbound call end error:', error);
        res.status(500).json({ success: false, message: 'Failed to log inbound call end' });
    }
});

// Inbound call error
router.post('/inbound-call-error', async(req, res) => {
    try {
        const { caller_id, caller_name, error, timestamp } = req.body;

        logger.error(`Inbound call error - Caller ID: ${caller_id}, Error: ${error}`);

        // Log inbound call error event
        await query(`
            INSERT INTO call_events (call_id, event_type, event_data)
            VALUES ($1, $2, $3)
        `, [caller_id, 'inbound_call_error', JSON.stringify({
            caller_id,
            caller_name,
            error,
            timestamp
        })]);

        res.json({ success: true, message: 'Inbound call error logged' });

    } catch (error) {
        logger.error('Inbound call error logging failed:', error);
        res.status(500).json({ success: false, message: 'Failed to log inbound call error' });
    }
});

// TTS generation endpoint
router.post('/tts/generate', async(req, res) => {
    try {
        const { text, voice = 'en-us', speed = 1.0 } = req.body;

        if (!text) {
            return res.status(400).json({
                success: false,
                message: 'Text is required for TTS generation'
            });
        }

        logger.info(`TTS request - Text: ${text.substring(0, 50)}..., Voice: ${voice}`);

        // Generate TTS audio
        const audioBuffer = await ttsService.generateSpeech(text, {
            voice: voice,
            speed: speed
        });

        // Save audio to temporary file
        const filename = `tts_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.wav`;
        const filepath = path.join(uploadDir, filename);

        fs.writeFileSync(filepath, audioBuffer);

        // Return URL to the audio file
        const audioUrl = `${req.protocol}://${req.get('host')}/api/v1/asterisk/audio/${filename}`;

        res.json({
            success: true,
            audio_url: audioUrl,
            filename: filename,
            duration: audioBuffer.length / 16000 // Rough estimate for 16kHz audio
        });

    } catch (error) {
        logger.error('TTS generation error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate TTS audio'
        });
    }
});

// Audio file serving endpoint
router.get('/audio/:filename', (req, res) => {
    try {
        const { filename } = req.params;
        const filepath = path.join(uploadDir, filename);

        if (!fs.existsSync(filepath)) {
            return res.status(404).json({
                success: false,
                message: 'Audio file not found'
            });
        }

        // Set appropriate headers
        res.setHeader('Content-Type', 'audio/wav');
        res.setHeader('Content-Length', fs.statSync(filepath).size);

        // Stream the file
        const fileStream = fs.createReadStream(filepath);
        fileStream.pipe(res);

        // Clean up file after serving (optional)
        fileStream.on('end', () => {
            setTimeout(() => {
                try {
                    fs.unlinkSync(filepath);
                } catch (err) {
                    logger.warn('Failed to clean up audio file:', err.message);
                }
            }, 30000); // Delete after 30 seconds
        });

    } catch (error) {
        logger.error('Audio serving error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to serve audio file'
        });
    }
});

// Speech transcription endpoint
router.post('/speech/transcribe', upload.single('audio'), async(req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'Audio file is required'
            });
        }

        const { filename, path: filepath } = req.file;
        logger.info(`Speech transcription request - File: ${filename}`);

        // Use Telnyx Speech Recognition if available
        if (process.env.TELNYX_API_KEY) {
            try {
                const FormData = require('form-data');
                const axios = require('axios');

                const formData = new FormData();
                formData.append('audio', fs.createReadStream(filepath));
                formData.append('language', 'en-US');

                const response = await axios.post(
                    'https://api.telnyx.com/v2/ai/transcribe',
                    formData,
                    {
                        headers: {
                            ...formData.getHeaders(),
                            'Authorization': `Bearer ${process.env.TELNYX_API_KEY}`
                        },
                        timeout: 15000
                    }
                );

                // Clean up uploaded file
                fs.unlinkSync(filepath);

                const transcription = response.data.data.text || '';
                logger.info(`✅ Transcribed: ${transcription.substring(0, 100)}...`);

                return res.json({
                    success: true,
                    text: transcription,
                    confidence: response.data.data.confidence || 0.8,
                    language: 'en-US'
                });

            } catch (telnyxError) {
                logger.error('Telnyx transcription error:', telnyxError.response?.data || telnyxError.message);
                // Fall through to fallback logic
            }
        }

        // Fallback: Smart silence detection and generic responses
        logger.warn('Speech-to-Text not configured - using smart fallback');

        // Check if audio file has sound (basic check)
        const stats = fs.statSync(filepath);
        const hasSound = stats.size > 5000; // If file > 5KB, likely has sound

        // Clean up
        fs.unlinkSync(filepath);

        if (!hasSound) {
            // No sound detected - return empty
            return res.json({
                success: true,
                text: '',  // Empty = no speech detected
                confidence: 0,
                language: 'en-US',
                fallback: true
            });
        }

        // Return generic affirmative response to keep conversation flowing
        // This at least allows testing without real STT
        const fallbackResponses = [
            'yes',
            'okay',
            'I understand',
            'tell me more',
            'go ahead',
            'sure',
            'I see'
        ];

        const randomResponse = fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];

        logger.info(`Using fallback response: "${randomResponse}"`);

        return res.json({
            success: true,
            text: randomResponse,
            confidence: 0.3,
            language: 'en-US',
            fallback: true
        });

    } catch (error) {
        logger.error('Speech transcription error:', error);

        // Clean up file on error
        if (req.file && req.file.path) {
            try {
                fs.unlinkSync(req.file.path);
            } catch (cleanupError) {
                logger.warn('Failed to clean up audio file after error');
            }
        }

        res.status(500).json({
            success: false,
            message: 'Failed to transcribe speech'
        });
    }
});

module.exports = router;
