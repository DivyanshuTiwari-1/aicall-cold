const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const axios = require('axios');
const logger = require('../utils/logger');

class TTSService {
    constructor() {
        this.engine = process.env.TTS_ENGINE || 'google';
        this.language = process.env.TTS_LANGUAGE || 'en-US';
        this.voice = process.env.TTS_VOICE || 'en-US-Wavenet-D';
        this.cacheDir = path.join(__dirname, '../../cache/tts');
        this.audioDir = path.join(__dirname, '../../audio/tts');

        // Ensure directories exist
        [this.cacheDir, this.audioDir].forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });

        // Voice configurations for different providers
        this.voices = {
            google: {
                'en-US-Wavenet-A': { gender: 'MALE', language: 'en-US' },
                'en-US-Wavenet-B': { gender: 'MALE', language: 'en-US' },
                'en-US-Wavenet-C': { gender: 'FEMALE', language: 'en-US' },
                'en-US-Wavenet-D': { gender: 'MALE', language: 'en-US' },
                'en-US-Wavenet-E': { gender: 'FEMALE', language: 'en-US' },
                'en-US-Wavenet-F': { gender: 'FEMALE', language: 'en-US' },
                'en-US-Standard-A': { gender: 'MALE', language: 'en-US' },
                'en-US-Standard-B': { gender: 'MALE', language: 'en-US' },
                'en-US-Standard-C': { gender: 'FEMALE', language: 'en-US' },
                'en-US-Standard-D': { gender: 'MALE', language: 'en-US' },
                'en-US-Standard-E': { gender: 'FEMALE', language: 'en-US' },
                'en-US-Standard-F': { gender: 'FEMALE', language: 'en-US' }
            },
            azure: {
                'en-US-AriaNeural': { gender: 'Female', language: 'en-US' },
                'en-US-DavisNeural': { gender: 'Male', language: 'en-US' },
                'en-US-GuyNeural': { gender: 'Male', language: 'en-US' },
                'en-US-JennyNeural': { gender: 'Female', language: 'en-US' },
                'en-US-JasonNeural': { gender: 'Male', language: 'en-US' },
                'en-US-NancyNeural': { gender: 'Female', language: 'en-US' }
            },
            aws: {
                'Joanna': { gender: 'Female', language: 'en-US' },
                'Matthew': { gender: 'Male', language: 'en-US' },
                'Amy': { gender: 'Female', language: 'en-GB' },
                'Brian': { gender: 'Male', language: 'en-GB' },
                'Emma': { gender: 'Female', language: 'en-GB' },
                'Joey': { gender: 'Male', language: 'en-US' }
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
            switch (this.engine) {
                case 'google':
                    return await this.generateGoogleTTS(text, voice, outputFile);

                case 'azure':
                    return await this.generateAzureTTS(text, voice, outputFile);

                case 'aws':
                    return await this.generateAWSTTS(text, voice, outputFile);

                case 'espeak':
                default:
                    return await this.generateEspeakTTS(text, voice, speed, pitch, volume, outputFile);
            }
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
            const command = `espeak -s ${speed} -p ${pitch} -a ${volume} -v ${voice} "${text}" -w "${outputFile}"`;

            exec(command, (error, stdout, stderr) => {
                if (error) {
                    logger.error('Espeak TTS error:', error);
                    reject(error);
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

    async generateGoogleTTS(text, voice, outputFile) {
        const apiKey = process.env.GOOGLE_TTS_API_KEY;
        if (!apiKey) {
            throw new Error('GOOGLE_TTS_API_KEY not configured');
        }

        const voiceConfig = this.voices.google[voice] || this.voices.google['en-US-Wavenet-D'];
        const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`;

        const requestBody = {
            input: { text: text },
            voice: {
                languageCode: voiceConfig.language,
                name: voice,
                ssmlGender: voiceConfig.gender
            },
            audioConfig: {
                audioEncoding: 'LINEAR16',
                sampleRateHertz: 16000,
                speakingRate: 1.0,
                pitch: 0.0,
                volumeGainDb: 0.0
            }
        };

        try {
            const response = await axios.post(url, requestBody, {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 30000
            });

            const audioContent = response.data.audioContent;
            const audioBuffer = Buffer.from(audioContent, 'base64');
            fs.writeFileSync(outputFile, audioBuffer);

            logger.info(`Google TTS: Generated audio for voice ${voice}`);
            return outputFile;
        } catch (error) {
            logger.error('Google TTS error:', error.response ? .data || error.message);
            throw error;
        }
    }

    async generateAzureTTS(text, voice, outputFile) {
        const apiKey = process.env.AZURE_TTS_API_KEY;
        const region = process.env.AZURE_TTS_REGION;

        if (!apiKey || !region) {
            throw new Error('AZURE_TTS_API_KEY and AZURE_TTS_REGION not configured');
        }

        const voiceConfig = this.voices.azure[voice] || this.voices.azure['en-US-AriaNeural'];
        const url = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;

        const ssml = `
            <speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='${voiceConfig.language}'>
                <voice name='${voice}'>
                    <prosody rate='1.0' pitch='0%' volume='100%'>
                        ${text}
                    </prosody>
                </voice>
            </speak>
        `;

        try {
            const response = await axios.post(url, ssml, {
                headers: {
                    'Ocp-Apim-Subscription-Key': apiKey,
                    'Content-Type': 'application/ssml+xml',
                    'X-Microsoft-OutputFormat': 'riff-16khz-16bit-mono-pcm'
                },
                timeout: 30000,
                responseType: 'arraybuffer'
            });

            fs.writeFileSync(outputFile, response.data);
            logger.info(`Azure TTS: Generated audio for voice ${voice}`);
            return outputFile;
        } catch (error) {
            logger.error('Azure TTS error:', error.response ? .data || error.message);
            throw error;
        }
    }

    async generateAWSTTS(text, voice, outputFile) {
        const AWS = require('aws-sdk');
        const polly = new AWS.Polly({
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            region: process.env.AWS_REGION || 'us-east-1'
        });

        const voiceConfig = this.voices.aws[voice] || this.voices.aws['Joanna'];

        const params = {
            Text: text,
            OutputFormat: 'pcm',
            VoiceId: voice,
            LanguageCode: voiceConfig.language,
            SampleRate: '16000',
            TextType: 'text'
        };

        try {
            const result = await polly.synthesizeSpeech(params).promise();
            fs.writeFileSync(outputFile, result.AudioStream);
            logger.info(`AWS Polly: Generated audio for voice ${voice}`);
            return outputFile;
        } catch (error) {
            logger.error('AWS Polly error:', error.message);
            throw error;
        }
    }

    generateAzureTTSCommand(text, voice, outputFile) {
        const apiKey = process.env.AZURE_TTS_API_KEY;
        const region = process.env.AZURE_TTS_REGION;

        if (!apiKey || !region) {
            throw new Error('AZURE_TTS_API_KEY and AZURE_TTS_REGION not configured');
        }

        const ssml = `
            <speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='${this.language}'>
                <voice name='${voice}'>
                    ${text}
                </voice>
            </speak>
        `;

        const url = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;

        return `curl -X POST "${url}" -H "Ocp-Apim-Subscription-Key: ${apiKey}" -H "Content-Type: application/ssml+xml" -H "X-Microsoft-OutputFormat: riff-16khz-16bit-mono-pcm" --data-raw '${ssml}' -o "${outputFile}"`;
    }

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