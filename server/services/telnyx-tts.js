/**
 * Telnyx Text-to-Speech Service
 * Uses Telnyx API for professional voice synthesis
 */

const axios = require('axios');
const logger = require('../utils/logger');
const fs = require('fs');
const path = require('path');

const TELNYX_API_KEY = process.env.TELNYX_API_KEY;
const TELNYX_API_BASE = process.env.TELNYX_API_V2 || 'https://api.telnyx.com/v2';

class TelnyxTTSService {
    constructor() {
        this.apiKey = TELNYX_API_KEY;
        this.cacheDir = path.join(__dirname, '../../cache/tts');

        // Ensure cache directory exists
        if (!fs.existsSync(this.cacheDir)) {
            fs.mkdirSync(this.cacheDir, { recursive: true });
        }

        this.client = axios.create({
            baseURL: TELNYX_API_BASE,
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            }
        });
    }

    /**
     * Generate speech from text using Telnyx TTS
     * @param {string} text - Text to convert to speech
     * @param {object} options - Voice options
     * @returns {Promise<string>} - Path to audio file
     */
    async generateSpeech(text, options = {}) {
        try {
            const {
                voice = 'female',
                language = 'en-US'
            } = options;

            // Create cache key
            const cacheKey = this.createCacheKey(text, voice, language);
            const cacheFile = path.join(this.cacheDir, `${cacheKey}.wav`);

            // Check cache
            if (fs.existsSync(cacheFile)) {
                logger.info(`Telnyx TTS: Using cached audio for: ${text.substring(0, 50)}...`);
                return cacheFile;
            }

            logger.info(`Telnyx TTS: Generating audio for: ${text.substring(0, 50)}...`);

            // Call Telnyx TTS API
            const response = await this.client.post('/text_to_speech', {
                text: text,
                voice: voice,
                language: language,
                output_format: 'wav'
            });

            // Telnyx returns audio data or URL
            let audioData;
            if (response.data.data && response.data.data.audio_url) {
                // Download audio from URL
                const audioResponse = await axios.get(response.data.data.audio_url, {
                    responseType: 'arraybuffer'
                });
                audioData = audioResponse.data;
            } else if (response.data.data && response.data.data.audio_base64) {
                // Convert base64 to buffer
                audioData = Buffer.from(response.data.data.audio_base64, 'base64');
            } else {
                throw new Error('No audio data in response');
            }

            // Save to cache
            fs.writeFileSync(cacheFile, audioData);

            logger.info(`Telnyx TTS: Audio generated and cached`);
            return cacheFile;

        } catch (error) {
            logger.error('Telnyx TTS error:', error.response?.data || error.message);

            // Fallback to eSpeak if Telnyx fails
            logger.warn('Falling back to eSpeak TTS');
            const espeakService = require('./tts-espeak');
            return await espeakService.generateSpeech(text, options);
        }
    }

    /**
     * Generate audio for multiple sentences
     */
    async generateScriptAudio(scriptContent, variables = {}) {
        try {
            // Replace variables in script
            let processedScript = scriptContent;
            Object.keys(variables).forEach(key => {
                const placeholder = `{${key}}`;
                processedScript = processedScript.replace(new RegExp(placeholder, 'g'), variables[key]);
            });

            // Generate single audio file for entire script
            // (Telnyx handles natural pauses)
            const audioFile = await this.generateSpeech(processedScript, {
                voice: process.env.TTS_VOICE || 'female',
                language: process.env.TTS_LANGUAGE || 'en-US'
            });

            return [audioFile]; // Return as array for compatibility

        } catch (error) {
            logger.error('Telnyx script audio generation error:', error);
            throw error;
        }
    }

    createCacheKey(text, voice, language) {
        const crypto = require('crypto');
        const content = `${text}-${voice}-${language}`;
        return crypto.createHash('md5').update(content).digest('hex');
    }

    /**
     * Clean up old cache files
     */
    cleanupCache(maxAge = 24 * 60 * 60 * 1000) { // 24 hours
        try {
            const files = fs.readdirSync(this.cacheDir);
            const now = Date.now();

            files.forEach(file => {
                const filePath = path.join(this.cacheDir, file);
                const stats = fs.statSync(filePath);

                if (now - stats.mtime.getTime() > maxAge) {
                    fs.unlinkSync(filePath);
                    logger.info(`Telnyx TTS: Cleaned up old cache file: ${file}`);
                }
            });
        } catch (error) {
            logger.error('Telnyx TTS cache cleanup error:', error);
        }
    }
}

module.exports = new TelnyxTTSService();
