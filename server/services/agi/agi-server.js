const net = require('net');
const logger = require('../../utils/logger');
const AiConversationHandler = require('./ai-conversation-handler');

/**
 * FastAGI Server for Asterisk
 * Handles AGI protocol communication and routes requests to conversation handler
 */

class AgiServer {
    constructor(port = 4573) {
        this.port = port;
        this.server = null;
        this.activeConnections = new Map();
    }

    start() {
        return new Promise((resolve, reject) => {
            this.server = net.createServer((socket) => {
                this.handleConnection(socket);
            });

            // Listen on 0.0.0.0 for Docker compatibility
            this.server.listen(this.port, '0.0.0.0', () => {
                logger.info(`✅ FastAGI Server listening on 0.0.0.0:${this.port}`);
                resolve();
            });

            this.server.on('error', (error) => {
                logger.error('❌ FastAGI Server error:', error);
                reject(error);
            });
        });
    }

    async handleConnection(socket) {
        const connectionId = `${socket.remoteAddress}:${socket.remotePort}`;
        logger.info(`📞 New AGI connection from ${connectionId}`);

        const agiContext = {
            socket,
            variables: {},
            buffer: '',
            connectionId
        };

        this.activeConnections.set(connectionId, agiContext);

        // Read AGI environment variables
        socket.on('data', async (data) => {
            await this.handleData(agiContext, data);
        });

        socket.on('error', (error) => {
            logger.error(`AGI connection error ${connectionId}:`, error);
            this.cleanup(connectionId);
        });

        socket.on('close', () => {
            logger.info(`AGI connection closed ${connectionId}`);
            this.cleanup(connectionId);
        });
    }

    async handleData(context, data) {
        context.buffer += data.toString();

        // Process complete lines
        while (context.buffer.includes('\n')) {
            const lineEnd = context.buffer.indexOf('\n');
            const line = context.buffer.substring(0, lineEnd).trim();
            context.buffer = context.buffer.substring(lineEnd + 1);

            if (line === '') {
                // Empty line signals end of AGI environment
                if (!context.initialized) {
                    context.initialized = true;
                    await this.routeRequest(context);
                }
            } else if (line.startsWith('agi_')) {
                // Parse AGI variable
                const [key, ...valueParts] = line.split(':');
                const value = valueParts.join(':').trim();
                context.variables[key] = value;
            } else if (line.startsWith('200 result=')) {
                // AGI command response
                context.lastResponse = line;
            }
        }
    }

    async routeRequest(context) {
        try {
            // Extract call parameters from AGI variables
            const callId = context.variables.agi_arg_1 || context.variables.agi_extension;
            const phoneNumber = context.variables.agi_arg_2 || context.variables.agi_callerid;
            const campaignId = context.variables.agi_arg_3 || 'unknown';

            logger.info(`Routing AGI request - Call: ${callId}, Phone: ${phoneNumber}, Campaign: ${campaignId}`);

            // Create conversation handler
            const handler = new AiConversationHandler(context, {
                callId,
                phoneNumber,
                campaignId
            });

            // Start AI conversation
            await handler.handleConversation();

        } catch (error) {
            logger.error('Error routing AGI request:', error);
            this.sendCommand(context, 'VERBOSE "Error handling call" 1');
            context.socket.end();
        }
    }

    sendCommand(context, command) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('AGI command timeout'));
            }, 5000);

            context.socket.write(command + '\n', (error) => {
                if (error) {
                    clearTimeout(timeout);
                    logger.error('Error sending AGI command:', error);
                    reject(error);
                } else {
                    // Wait for response
                    const checkResponse = () => {
                        if (context.lastResponse) {
                            clearTimeout(timeout);
                            const response = context.lastResponse;
                            context.lastResponse = null;
                            resolve(response);
                        } else {
                            setTimeout(checkResponse, 50);
                        }
                    };
                    checkResponse();
                }
            });
        });
    }

    cleanup(connectionId) {
        this.activeConnections.delete(connectionId);
    }

    stop() {
        return new Promise((resolve) => {
            if (this.server) {
                // Close all active connections
                this.activeConnections.forEach((context) => {
                    context.socket.end();
                });
                this.activeConnections.clear();

                this.server.close(() => {
                    logger.info('FastAGI Server stopped');
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }

    getActiveConnectionCount() {
        return this.activeConnections.size;
    }
}

module.exports = AgiServer;
