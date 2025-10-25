const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const logger = require('../utils/logger');

/**
 * Piper TTS Service - Human-like voice quality, self-hosted, FREE
 * Much better than eSpeak, comparable to commercial services
 */
class PiperTTSService {
    constructor() {
        this.piperPath = process.env.PIPER_PATH || '/usr/local/bin/piper';
        this.modelPath = process.env.PIPER_MODEL_PATH || '/models/piper';
        this.cacheDir = path.join(__dirname, '../../audio-cache/piper');
        this.audioDir = path.join(__dirname, '../../audio/piper');

        // Ensure directories exist
        [this.cacheDir, this.audioDir].forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });

        // Human-like voice models (download these)
        this.voices = {
            'amy': { file: 'en_US-amy-medium.onnx', gender: 'female', quality: 'high' },
            'ryan': { file: 'en_US-ryan-medium.onnx', gender: 'male', quality: 'high' },
            'lessac': { file: 'en_US-lessac-medium.onnx', gender: 'male', quality: 'high' },
            'kristin': { file: 'en_US-kristin-medium.onnx', gender: 'female', quality: 'high' }
        };

        this.defaultVoice = 'amy';
    }

    /**
     * Generate speech using Piper TTS
     */
    async generateSpeech(text, options = {}) {
        try {
            const {
                voice = this.defaultVoice,
                speed = 1.0,
                outputFormat = 'wav'
            } = options;

            // Create unique filename for caching
            const hash = this.getCacheKey(text, voice, speed);
            const outputFile = path.join(this.audioDir, `${hash}.${outputFormat}`);

            // Check cache first
            if (fs.existsSync(outputFile)) {
                logger.info('Piper TTS: Using cached audio');
                return {
                    success: true,
                    audioUrl: `/api/v1/asterisk/audio/${hash}.${outputFormat}`,
                    audioFile: outputFile,
                    cached: true
                };
            }

            // Generate with Piper
            const result = await this.generateWithPiper(text, voice, speed, outputFile);

            if (result.success) {
                return {
                    success: true,
                    audioUrl: `/api/v1/asterisk/audio/${hash}.${outputFormat}`,
                    audioFile: outputFile,
                    cached: false
                };
            }

            throw new Error('Piper TTS generation failed');

        } catch (error) {
            logger.error('Piper TTS generation error:', error);
            throw error;
        }
    }

    /**
     * Generate audio using Piper command line
     */
    async generateWithPiper(text, voice, speed, outputFile) {
        return new Promise((resolve, reject) => {
            const voiceConfig = this.voices[voice] || this.voices[this.defaultVoice];
            const modelFile = path.join(this.modelPath, voiceConfig.file);

            // Check if model exists
            if (!fs.existsSync(modelFile)) {
                logger.error(`Piper model not found: ${modelFile}`);
                return reject(new Error(`Voice model not found: ${voice}`));
            }

            // Piper command with length scale for speed control
            // length_scale > 1.0 = slower, < 1.0 = faster
            const lengthScale = 1.0 / speed;
            
            // Echo text into piper, output to file
            const command = `echo "${text.replace(/"/g, '\\"')}" | ${this.piperPath} --model ${modelFile} --length_scale ${lengthScale} --output_file ${outputFile}`;

            logger.info(`Generating Piper TTS with voice: ${voice}`);

            exec(command, (error, stdout, stderr) => {
                if (error) {
                    logger.error(`Piper TTS error: ${error.message}`);
                    logger.error(`Stderr: ${stderr}`);
                    return reject(error);
                }

                if (!fs.existsSync(outputFile)) {
                    return reject(new Error('Piper TTS file was not created'));
                }

                const stats = fs.statSync(outputFile);
                logger.info(`Piper TTS generated: ${stats.size} bytes`);

                resolve({
                    success: true,
                    audioFile: outputFile,
                    engine: 'piper'
                });
            });
        });
    }

    /**
     * Get available voices
     */
    async getAvailableVoices() {
        const availableVoices = [];

        for (const [name, config] of Object.entries(this.voices)) {
            const modelFile = path.join(this.modelPath, config.file);
            const available = fs.existsSync(modelFile);

            availableVoices.push({
                name,
                gender: config.gender,
                quality: config.quality,
                available,
                language: 'en-US'
            });
        }

        return availableVoices;
    }

    /**
     * Generate cache key
     */
    getCacheKey(text, voice, speed) {
        const crypto = require('crypto');
        const data = `${text}-${voice}-${speed}`;
        return crypto.createHash('md5').update(data).digest('hex');
    }

    /**
     * Clean up old cache files
     */
    async cleanupCache(maxAge = 24 * 60 * 60 * 1000) {
        try {
            const now = Date.now();
            const files = fs.readdirSync(this.audioDir);

            let cleaned = 0;
            for (const file of files) {
                const filepath = path.join(this.audioDir, file);
                const stats = fs.statSync(filepath);

                if (now - stats.mtimeMs > maxAge) {
                    fs.unlinkSync(filepath);
                    cleaned++;
                }
            }

            if (cleaned > 0) {
                logger.info(`Piper TTS: Cleaned up ${cleaned} old audio files`);
            }
        } catch (error) {
            logger.error('Piper TTS cache cleanup error:', error);
        }
    }
}

module.exports = new PiperTTSService();




