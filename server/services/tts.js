const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const logger = require('../utils/logger');

class TTSService {
    constructor() {
        this.engine = process.env.TTS_ENGINE || 'espeak';
        this.language = process.env.TTS_LANGUAGE || 'en-US';
        this.voice = process.env.TTS_VOICE || 'en-us';
        this.cacheDir = path.join(__dirname, '../../cache/tts');
        this.audioDir = path.join(__dirname, '../../audio/tts');

        // Ensure directories exist
        [this.cacheDir, this.audioDir].forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });

        // Voice configurations for eSpeak only (cost optimization)
        this.voices = {
            espeak: {
                'en-us': { gender: 'MALE', language: 'en-US' },
                'en-us+f3': { gender: 'FEMALE', language: 'en-US' },
                'en-us+m1': { gender: 'MALE', language: 'en-US' },
                'en-us+m2': { gender: 'MALE', language: 'en-US' },
                'en-us+f1': { gender: 'FEMALE', language: 'en-US' },
                'en-us+f2': { gender: 'FEMALE', language: 'en-US' }
            }
        };
    }

    async generateSpeech(text, options = {}) {
        try {
            const {
                voice = this.voice,
                    speed = 150,
                    pitch = 50,
                    volume = 100
            } = options;

            // Create cache key for the text
            const cacheKey = this.createCacheKey(text, voice, speed, pitch, volume);
            const cacheFile = path.join(this.cacheDir, `${cacheKey}.wav`);

            // Check if cached version exists
            if (fs.existsSync(cacheFile)) {
                logger.info(`TTS: Using cached audio for text: ${text.substring(0, 50)}...`);
                return cacheFile;
            }

            // Generate new audio
            const audioFile = await this.generateAudio(text, {
                voice,
                speed,
                pitch,
                volume,
                outputFile: cacheFile
            });

            logger.info(`TTS: Generated audio for text: ${text.substring(0, 50)}...`);
            return audioFile;

        } catch (error) {
            logger.error('TTS generation error:', error);
            throw error;
        }
    }

    async generateAudio(text, options) {
        const { voice, speed, pitch, volume, outputFile } = options;

        try {
            // Only use eSpeak for cost optimization
            return await this.generateEspeakTTS(text, voice, speed, pitch, volume, outputFile);
        } catch (error) {
            logger.error('TTS generation error:', error);
            // Fallback to espeak if other engines fail
            if (this.engine !== 'espeak') {
                logger.info('Falling back to espeak TTS');
                return await this.generateEspeakTTS(text, voice, speed, pitch, volume, outputFile);
            }
            throw error;
        }
    }

    async generateEspeakTTS(text, voice, speed, pitch, volume, outputFile) {
        return new Promise((resolve, reject) => {
            // Use espeak with optimized parameters for better quality
            const command = `espeak -s ${speed} -p ${pitch} -a ${volume} -v ${voice} "${text}" -w "${outputFile}" --stdout | sox -t wav - -r 16000 -c 1 "${outputFile}"`;

            exec(command, (error, stdout, stderr) => {
                if (error) {
                    // Fallback to basic espeak command if sox is not available
                    const fallbackCommand = `espeak -s ${speed} -p ${pitch} -a ${volume} -v ${voice} "${text}" -w "${outputFile}"`;

                    exec(fallbackCommand, (fallbackError, fallbackStdout, fallbackStderr) => {
                        if (fallbackError) {
                            logger.error('Espeak TTS error:', fallbackError);
                            reject(fallbackError);
                            return;
                        }

                        if (fs.existsSync(outputFile)) {
                            logger.info(`Espeak TTS: Generated audio for voice ${voice}`);
                            resolve(outputFile);
                        } else {
                            reject(new Error('Espeak TTS audio file was not created'));
                        }
                    });
                    return;
                }

                if (fs.existsSync(outputFile)) {
                    logger.info(`Espeak TTS: Generated audio for voice ${voice}`);
                    resolve(outputFile);
                } else {
                    reject(new Error('Espeak TTS audio file was not created'));
                }
            });
        });
    }

    // All external TTS APIs removed for cost optimization - using eSpeak only

    createCacheKey(text, voice, speed, pitch, volume) {
        const crypto = require('crypto');
        const content = `${text}-${voice}-${speed}-${pitch}-${volume}`;
        return crypto.createHash('md5').update(content).digest('hex');
    }

    async generateScriptAudio(scriptContent, variables = {}) {
        try {
            // Replace variables in script
            let processedScript = scriptContent;
            Object.keys(variables).forEach(key => {
                const placeholder = `{${key}}`;
                processedScript = processedScript.replace(new RegExp(placeholder, 'g'), variables[key]);
            });

            // Split script into sentences for better TTS
            const sentences = this.splitIntoSentences(processedScript);
            const audioFiles = [];

            for (const sentence of sentences) {
                if (sentence.trim()) {
                    const audioFile = await this.generateSpeech(sentence.trim(), {
                        speed: 140, // Slightly slower for better comprehension
                        pitch: 45, // Slightly lower pitch for professional sound
                        volume: 90
                    });
                    audioFiles.push(audioFile);
                }
            }

            return audioFiles;

        } catch (error) {
            logger.error('Script audio generation error:', error);
            throw error;
        }
    }

    splitIntoSentences(text) {
        // Split by sentence endings but keep natural pauses
        return text
            .split(/([.!?]+)/)
            .filter(part => part.trim())
            .map(part => part.trim())
            .filter(part => part.length > 0);
    }

    // Clean up old cache files
    cleanupCache(maxAge = 24 * 60 * 60 * 1000) { // 24 hours
        try {
            const files = fs.readdirSync(this.cacheDir);
            const now = Date.now();

            files.forEach(file => {
                const filePath = path.join(this.cacheDir, file);
                const stats = fs.statSync(filePath);

                if (now - stats.mtime.getTime() > maxAge) {
                    fs.unlinkSync(filePath);
                    logger.info(`TTS: Cleaned up old cache file: ${file}`);
                }
            });
        } catch (error) {
            logger.error('TTS cache cleanup error:', error);
        }
    }
}

module.exports = new TTSService();