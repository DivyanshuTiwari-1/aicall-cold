const AriClient = require('ari-client');
const logger = require('../../utils/logger');
const AiDialerStasisApp = require('./ai-dialer-app');
const ManualBridgeStasisApp = require('./manual-bridge-app');

class StasisAppManager {
    constructor() {
        this.ari = null;
        this.aiDialerApp = null;
        this.manualBridgeApp = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 5000; // 5 seconds
    }

    async initialize() {
        try {
            await this.connectToAri();
            await this.registerStasisApps();
            logger.info('✅ Stasis App Manager initialized successfully');
        } catch (error) {
            logger.error('❌ Failed to initialize Stasis App Manager:', error);
            throw error;
        }
    }

    async connectToAri() {
        try {
            const ARI_URL = process.env.ARI_URL || 'http://localhost:8088/ari';
            const ARI_USER = process.env.ARI_USERNAME || process.env.ARI_USER || 'ai-dialer';
            const ARI_PASS = process.env.ARI_PASSWORD || process.env.ARI_PASS || 'ai-dialer-password';

            logger.info(`Connecting to ARI at ${ARI_URL}...`);

            this.ari = await AriClient.connect(ARI_URL, ARI_USER, ARI_PASS);
            this.isConnected = true;
            this.reconnectAttempts = 0;

            // Set up connection event handlers
            this.ari.on('error', (error) => {
                logger.error('ARI connection error:', error);
                this.isConnected = false;
                this.scheduleReconnect();
            });

            this.ari.on('close', () => {
                logger.warn('ARI connection closed');
                this.isConnected = false;
                this.scheduleReconnect();
            });

            logger.info('✅ Connected to Asterisk ARI');

        } catch (error) {
            logger.error('❌ Failed to connect to ARI:', error);
            throw error;
        }
    }

    async registerStasisApps() {
        try {
            if (!this.ari) {
                throw new Error('ARI client not connected');
            }

            // Register AI Dialer Stasis App
            this.aiDialerApp = new AiDialerStasisApp(this.ari);
            logger.info('✅ AI Dialer Stasis App registered');

            // Register Manual Bridge Stasis App
            this.manualBridgeApp = new ManualBridgeStasisApp(this.ari);
            logger.info('✅ Manual Bridge Stasis App registered');

            // Start the ARI client
            await this.ari.start('ai-dialer-stasis', 'manual-dialer-bridge-stasis');
            logger.info('✅ Stasis applications started');

        } catch (error) {
            logger.error('❌ Failed to register Stasis apps:', error);
            throw error;
        }
    }

    scheduleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            logger.error('❌ Max reconnection attempts reached. Giving up.');
            return;
        }

        this.reconnectAttempts++;
        const delay = this.reconnectDelay * this.reconnectAttempts;

        logger.info(`🔄 Scheduling reconnection attempt ${this.reconnectAttempts} in ${delay}ms`);

        setTimeout(async () => {
            try {
                await this.reconnect();
            } catch (error) {
                logger.error('Reconnection attempt failed:', error);
            }
        }, delay);
    }

    async reconnect() {
        try {
            logger.info('🔄 Attempting to reconnect to ARI...');

            // Clean up existing connection
            if (this.ari) {
                try {
                    await this.ari.stop();
                } catch (error) {
                    logger.warn('Error stopping ARI client:', error);
                }
            }

            // Reconnect
            await this.connectToAri();
            await this.registerStasisApps();

            logger.info('✅ Successfully reconnected to ARI');

        } catch (error) {
            logger.error('❌ Reconnection failed:', error);
            this.scheduleReconnect();
        }
    }

    async shutdown() {
        try {
            logger.info('🔄 Shutting down Stasis App Manager...');

            if (this.ari) {
                await this.ari.stop();
                logger.info('✅ ARI client stopped');
            }

            this.isConnected = false;
            logger.info('✅ Stasis App Manager shutdown complete');

        } catch (error) {
            logger.error('❌ Error during shutdown:', error);
        }
    }

    // Utility methods for external access
    getAriClient() {
        return this.ari;
    }

    getAiDialerApp() {
        return this.aiDialerApp;
    }

    getManualBridgeApp() {
        return this.manualBridgeApp;
    }

    isAriConnected() {
        return this.isConnected;
    }

    getActiveCalls() {
        const aiCalls = this.aiDialerApp ? this.aiDialerApp.getActiveCalls() : [];
        const manualCalls = this.manualBridgeApp ? this.manualBridgeApp.getActiveBridges() : [];

        return {
            aiCalls,
            manualCalls,
            total: aiCalls.length + manualCalls.length
        };
    }

    // Health check method
    async healthCheck() {
        try {
            if (!this.isConnected || !this.ari) {
                return {
                    status: 'disconnected',
                    message: 'ARI not connected'
                };
            }

            // Try to get Asterisk info to verify connection
            const info = await this.ari.asterisk.getInfo();

            return {
                status: 'connected',
                message: 'ARI connected and responsive',
                asteriskVersion: info.build?.version || 'unknown',
                activeCalls: this.getActiveCalls()
            };

        } catch (error) {
            return {
                status: 'error',
                message: error.message
            };
        }
    }
}

// Create singleton instance
const stasisManager = new StasisAppManager();

module.exports = stasisManager;

