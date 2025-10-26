const fs = require('fs');
const { exec } = require('child_process');
const logger = require('../utils/logger');

/**
 * Vosk STT Service - Self-hosted speech recognition, FREE
 * Fast, accurate, works offline
 * Alternative to expensive cloud STT services
 */
class VoskSTTService {
    constructor() {
        this.modelPath = process.env.VOSK_MODEL_PATH || '/models/vosk/vosk-model-small-en-us-0.15';
        this.pythonScript = __dirname + '/vosk_transcribe.py';
    }

    /**
     * Transcribe audio file to text
     */
    async transcribe(audioFilePath) {
        try {
            if (!fs.existsSync(audioFilePath)) {
                logger.error('Audio file not found:', audioFilePath);
                return { text: '', confidence: 0, error: 'File not found' };
            }

            logger.info(`Vosk STT: Transcribing ${audioFilePath}`);

            // Use Python Vosk script for transcription
            const result = await this.runVoskTranscription(audioFilePath);

            if (result.success) {
                logger.info(`Vosk STT: "${result.text.substring(0, 100)}..."`);
                return {
                    text: result.text,
                    confidence: result.confidence || 0.8,
                    success: true
                };
            }

            // Fallback if Vosk fails
            logger.warn('Vosk STT failed, returning empty');
            return { text: '', confidence: 0, success: false };

        } catch (error) {
            logger.error('Vosk STT error:', error);
            return { text: '', confidence: 0, error: error.message };
        }
    }

    /**
     * Run Vosk transcription using Python
     */
    async runVoskTranscription(audioFilePath) {
        return new Promise((resolve, reject) => {
            // Command to run Python Vosk script
            const command = `python3 ${this.pythonScript} "${audioFilePath}" "${this.modelPath}"`;

            exec(command, { maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
                if (error) {
                    logger.error('Vosk transcription error:', error.message);
                    logger.error('Stderr:', stderr);
                    return resolve({ success: false, text: '', confidence: 0 });
                }

                try {
                    // Parse JSON output from Python script
                    const result = JSON.parse(stdout);
                    resolve({
                        success: true,
                        text: result.text || '',
                        confidence: result.confidence || 0.8
                    });
                } catch (parseError) {
                    logger.error('Failed to parse Vosk output:', parseError);
                    resolve({ success: false, text: '', confidence: 0 });
                }
            });
        });
    }

    /**
     * Check if Vosk is properly configured
     */
    async checkConfiguration() {
        const modelExists = fs.existsSync(this.modelPath);
        const scriptExists = fs.existsSync(this.pythonScript);

        return {
            configured: modelExists && scriptExists,
            modelPath: this.modelPath,
            modelExists,
            scriptExists
        };
    }
}

module.exports = new VoskSTTService();






