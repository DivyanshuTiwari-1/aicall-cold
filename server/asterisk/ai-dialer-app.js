const ari = require('ari-client');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const ttsService = require('../services/tts');
const logger = require('../utils/logger');

class AIDialerApp {
    constructor() {
        this.client = null;
        this.activeCalls = new Map();
        this.apiUrl = process.env.API_URL || 'http://localhost:3000/api/v1';
    }

    async connect() {
        try {
            const ariUrl = process.env.ARI_URL || 'http://localhost:8088/ari';
            const username = process.env.ARI_USERNAME || 'ai-dialer';
            const password = process.env.ARI_PASSWORD || 'ai-dialer-password';

            this.client = await ari.connect(ariUrl, username, password);
            logger.info('✅ Connected to Asterisk ARI');

            // Register event handlers
            this.setupEventHandlers();

            // Start the application
            this.client.applications.subscribe({
                applicationName: 'ai-dialer'
            });

            logger.info('✅ AI Dialer ARI application started');

        } catch (error) {
            logger.error('❌ Failed to connect to Asterisk ARI:', error);
            throw error;
        }
    }

    setupEventHandlers() {
        // Handle channel creation
        this.client.on('ChannelCreated', (event, channel) => {
            logger.info(`Channel created: ${channel.id}`);
        });

        // Handle channel state changes
        this.client.on('ChannelStateChange', async(event, channel) => {
            logger.info(`Channel ${channel.id} state changed to: ${channel.state}`);

            if (channel.state === 'Up') {
                await this.handleChannelAnswered(channel);
            } else if (channel.state === 'Down') {
                await this.handleChannelHangup(channel);
            }
        });

        // Handle channel destruction
        this.client.on('ChannelDestroyed', async(event, channel) => {
            logger.info(`Channel destroyed: ${channel.id}`);
            await this.handleChannelHangup(channel);
        });

        // Handle DTMF (key presses)
        this.client.on('ChannelDtmfReceived', async(event, channel) => {
            logger.info(`DTMF received on ${channel.id}: ${event.digit}`);
            await this.handleDTMF(channel, event.digit);
        });

        // Handle playback finished
        this.client.on('PlaybackFinished', async(event, playback) => {
            logger.info(`Playback finished: ${playback.id}`);
            await this.handlePlaybackFinished(playback);
        });
    }

    async handleChannelAnswered(channel) {
        try {
            const callId = channel.caller.id;
            logger.info(`Channel answered: ${channel.id}, Call ID: ${callId}`);

            // Get call details from our API
            const callDetails = await this.getCallDetails(callId);
            if (!callDetails) {
                logger.error(`Call details not found for ID: ${callId}`);
                return;
            }

            // Store active call
            this.activeCalls.set(channel.id, {
                callId,
                channel,
                callDetails,
                conversationState: 'greeting',
                scriptIndex: 0,
                userResponses: []
            });

            // Start the conversation
            await this.startConversation(channel);

        } catch (error) {
            logger.error('Error handling channel answered:', error);
        }
    }

    async handleChannelHangup(channel) {
        try {
            const callData = this.activeCalls.get(channel.id);
            if (callData) {
                logger.info(`Call ended: ${callData.callId}`);

                // Update call status in database
                await this.updateCallStatus(callData.callId, {
                    status: 'completed',
                    duration: Math.floor((Date.now() - callData.startTime) / 1000),
                    transcript: callData.userResponses.join(' | ')
                });

                this.activeCalls.delete(channel.id);
            }
        } catch (error) {
            logger.error('Error handling channel hangup:', error);
        }
    }

    async handleDTMF(channel, digit) {
        try {
            const callData = this.activeCalls.get(channel.id);
            if (!callData) return;

            logger.info(`DTMF received: ${digit} for call ${callData.callId}`);

            // Handle different DTMF responses
            switch (digit) {
                case '1':
                    await this.handlePositiveResponse(channel, callData);
                    break;
                case '2':
                    await this.handleNegativeResponse(channel, callData);
                    break;
                case '0':
                    await this.handleTransferRequest(channel, callData);
                    break;
                case '#':
                    await this.handleRepeatRequest(channel, callData);
                    break;
                default:
                    await this.handleUnknownResponse(channel, callData, digit);
            }

        } catch (error) {
            logger.error('Error handling DTMF:', error);
        }
    }

    async startConversation(channel) {
        try {
            const callData = this.activeCalls.get(channel.id);
            if (!callData) return;

            // Set conversation state
            callData.conversationState = 'greeting';
            callData.startTime = Date.now();

            // Play greeting
            await this.playGreeting(channel, callData);

            // Get the main pitch script
            const script = await this.getScript(callData.callDetails.campaignId, 'main_pitch');
            if (!script) {
                await this.playMessage(channel, "I'm sorry, I don't have a script for this call. Let me transfer you to a human representative.");
                callData.conversationState = 'transfer';
                await this.handleTransfer(channel, callData);
                return;
            }

            // Update state to script
            callData.conversationState = 'script';
            callData.scriptIndex = 0;

            // Generate TTS audio for the script
            const audioFiles = await ttsService.generateScriptAudio(script.content, {
                contact_name: callData.callDetails.contactName,
                company: callData.callDetails.company || 'our company'
            });

            // Play the script
            await this.playAudioFiles(channel, audioFiles);

            // Ask for response
            await this.askForResponse(channel, callData);

        } catch (error) {
            logger.error('Error starting conversation:', error);
        }
    }

    async playGreeting(channel, callData) {
        try {
            const greetingScript = await this.getScript(callData.callDetails.campaignId, 'greeting');
            let greetingText;

            if (greetingScript) {
                greetingText = this.processScript(greetingScript.content, {
                    contact_name: callData.callDetails.contactName,
                    company: callData.callDetails.company || 'our company'
                });
            } else {
                // Default greeting
                greetingText = `Hello ${callData.callDetails.contactName || 'there'}, this is calling from ${callData.callDetails.company || 'our company'}. I hope I'm not catching you at a bad time.`;
            }

            await this.playMessage(channel, greetingText);
        } catch (error) {
            logger.error('Error playing greeting:', error);
        }
    }

    async playAudioFiles(channel, audioFiles) {
        try {
            for (const audioFile of audioFiles) {
                if (fs.existsSync(audioFile)) {
                    await channel.play({
                        media: `sound:${path.basename(audioFile, '.wav')}`
                    });
                }
            }
        } catch (error) {
            logger.error('Error playing audio files:', error);
        }
    }

    async playMessage(channel, message) {
        try {
            const audioFile = await ttsService.generateSpeech(message);
            if (fs.existsSync(audioFile)) {
                await channel.play({
                    media: `sound:${path.basename(audioFile, '.wav')}`
                });
            }
        } catch (error) {
            logger.error('Error playing message:', error);
        }
    }

    async askForResponse(channel, callData) {
        const message = "Please press 1 if you're interested, 2 if you're not interested, or 0 to speak with a human representative.";
        await this.playMessage(channel, message);

        // Start recording for voice input
        await channel.record({
            name: `call_${callData.callId}_${Date.now()}`,
            format: 'wav',
            maxDurationSeconds: 30,
            terminateOn: '#'
        });
    }

    async handlePositiveResponse(channel, callData) {
        callData.conversationState = 'positive';
        callData.userResponses.push('Interested');

        await this.playMessage(channel, "Great! I'd love to tell you more about our product. Let me transfer you to one of our specialists who can answer all your questions.");

        // Update call status
        await this.updateCallStatus(callData.callId, {
            emotion: 'positive',
            outcome: 'interested'
        });
    }

    async handleNegativeResponse(channel, callData) {
        callData.conversationState = 'negative';
        callData.userResponses.push('Not interested');

        await this.playMessage(channel, "I understand. Thank you for your time. Have a great day!");

        // Update call status
        await this.updateCallStatus(callData.callId, {
            emotion: 'negative',
            outcome: 'not_interested'
        });
    }

    async handleTransferRequest(channel, callData) {
        callData.conversationState = 'transfer';
        callData.userResponses.push('Requested human transfer');

        await this.playMessage(channel, "I'll transfer you to one of our human representatives right away. Please hold on.");

        // Update call status
        await this.updateCallStatus(callData.callId, {
            outcome: 'transferred_to_human'
        });
    }

    async handleRepeatRequest(channel, callData) {
        await this.playMessage(channel, "Let me repeat that for you.");
        await this.startConversation(channel);
    }

    async handleUnknownResponse(channel, callData, digit) {
        await this.playMessage(channel, "I didn't understand that. Please press 1 for yes, 2 for no, or 0 to speak with a human.");
    }

    async getCallDetails(callId) {
        try {
            const response = await axios.get(`${this.apiUrl}/calls/${callId}`, {
                headers: {
                    'Authorization': `Bearer ${process.env.API_TOKEN}`
                }
            });
            return response.data.call;
        } catch (error) {
            logger.error('Error getting call details:', error);
            return null;
        }
    }

    async getScript(campaignId, type) {
        try {
            const response = await axios.get(`${this.apiUrl}/scripts`, {
                params: { campaign_id: campaignId, type },
                headers: {
                    'Authorization': `Bearer ${process.env.API_TOKEN}`
                }
            });
            return response.data.scripts[0];
        } catch (error) {
            logger.error('Error getting script:', error);
            return null;
        }
    }

    async updateCallStatus(callId, statusData) {
        try {
            await axios.put(`${this.apiUrl}/calls/${callId}/status`, statusData, {
                headers: {
                    'Authorization': `Bearer ${process.env.API_TOKEN}`
                }
            });
        } catch (error) {
            logger.error('Error updating call status:', error);
        }
    }

    async handlePlaybackFinished(playback) {
        // Handle when TTS playback finishes
        logger.info(`Playback finished: ${playback.id}`);
    }

    async handleTransfer(channel, callData) {
        try {
            callData.conversationState = 'transfer';

            // Get transfer number from campaign settings
            const transferNumber = await this.getTransferNumber(callData.callDetails.campaignId);

            if (transferNumber) {
                await this.playMessage(channel, "I'm connecting you with one of our specialists right now. Please hold on.");

                // Initiate transfer
                await channel.redirect({
                    endpoint: `PJSIP/${transferNumber}@telnyx_endpoint`
                });

                // Update call status
                await this.updateCallStatus(callData.callId, {
                    outcome: 'transferred_to_human',
                    transfer_number: transferNumber
                });
            } else {
                // Fallback to voicemail
                await this.handleVoicemail(channel, callData);
            }
        } catch (error) {
            logger.error('Error handling transfer:', error);
            await this.handleVoicemail(channel, callData);
        }
    }

    async handleVoicemail(channel, callData) {
        try {
            const voicemailMessage = `I'm sorry, but I'm unable to connect you with a representative at this time. Please leave a message and someone will get back to you shortly.`;
            await this.playMessage(channel, voicemailMessage);

            // Start recording
            const recordFile = `voicemail_${callData.callId}_${Date.now()}`;
            await channel.record({
                name: recordFile,
                format: 'wav',
                maxDurationSeconds: 60,
                terminateOn: '#'
            });

            // Update call status
            await this.updateCallStatus(callData.callId, {
                outcome: 'voicemail_left',
                voicemail_file: recordFile
            });
        } catch (error) {
            logger.error('Error handling voicemail:', error);
        }
    }

    async getTransferNumber(campaignId) {
        try {
            const response = await axios.get(`${this.apiUrl}/campaigns/${campaignId}/transfer`, {
                headers: {
                    'Authorization': `Bearer ${process.env.API_TOKEN}`
                }
            });
            return response.data.transfer_number;
        } catch (error) {
            logger.error('Error getting transfer number:', error);
            return null;
        }
    }

    processScript(scriptContent, variables) {
        let processedScript = scriptContent;
        Object.keys(variables).forEach(key => {
            const placeholder = `{${key}}`;
            processedScript = processedScript.replace(new RegExp(placeholder, 'g'), variables[key]);
        });
        return processedScript;
    }

    // Enhanced conversation flow management
    async handleConversationFlow(channel, callData, userInput) {
        try {
            switch (callData.conversationState) {
                case 'greeting':
                    await this.handleGreetingResponse(channel, callData, userInput);
                    break;
                case 'script':
                    await this.handleScriptResponse(channel, callData, userInput);
                    break;
                case 'followup':
                    await this.handleFollowupResponse(channel, callData, userInput);
                    break;
                default:
                    logger.warn(`Unknown conversation state: ${callData.conversationState}`);
            }
        } catch (error) {
            logger.error('Error handling conversation flow:', error);
        }
    }

    async handleGreetingResponse(channel, callData, userInput) {
        // Move to script phase
        callData.conversationState = 'script';
        await this.startConversation(channel);
    }

    async handleScriptResponse(channel, callData, userInput) {
        // Process the response and determine next action
        const responseAnalysis = await this.analyzeResponse(userInput);

        switch (responseAnalysis.action) {
            case 'positive':
                await this.handlePositiveResponse(channel, callData);
                break;
            case 'negative':
                await this.handleNegativeResponse(channel, callData);
                break;
            case 'transfer':
                await this.handleTransferRequest(channel, callData);
                break;
            case 'unclear':
                await this.handleUnclearResponse(channel, callData);
                break;
        }
    }

    async handleFollowupResponse(channel, callData, userInput) {
        // Handle follow-up conversation
        const followupScript = await this.getScript(callData.callDetails.campaignId, 'followup');
        if (followupScript) {
            const processedScript = this.processScript(followupScript.content, {
                contact_name: callData.callDetails.contactName,
                company: callData.callDetails.company || 'our company',
                user_response: userInput
            });

            await this.playMessage(channel, processedScript);
        }

        // Ask for final decision
        await this.askForResponse(channel, callData);
    }

    async analyzeResponse(userInput) {
        // Simple response analysis - in production, this would use AI/ML
        if (typeof userInput === 'string') {
            const input = userInput.toLowerCase();
            if (input.includes('yes') || input.includes('interested') || input.includes('sounds good')) {
                return { action: 'positive', confidence: 0.8 };
            } else if (input.includes('no') || input.includes('not interested') || input.includes('not now')) {
                return { action: 'negative', confidence: 0.8 };
            } else if (input.includes('human') || input.includes('representative') || input.includes('person')) {
                return { action: 'transfer', confidence: 0.9 };
            }
        }

        return { action: 'unclear', confidence: 0.0 };
    }

    async handleUnclearResponse(channel, callData) {
        await this.playMessage(channel, "I'm sorry, I didn't quite catch that. Could you please press 1 for yes, 2 for no, or 0 to speak with a human representative?");

        // Record again
        const recordFile = `call_${callData.callId}_clarify_${Date.now()}`;
        await channel.record({
            name: recordFile,
            format: 'wav',
            maxDurationSeconds: 15,
            terminateOn: '#'
        });
    }
}

// Start the application
const app = new AIDialerApp();
app.connect().catch(error => {
    logger.error('Failed to start AI Dialer app:', error);
    process.exit(1);
});

module.exports = AIDialerApp;