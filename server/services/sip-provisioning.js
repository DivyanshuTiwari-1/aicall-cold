const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const logger = require('../utils/logger');

class SipProvisioningService {
    constructor() {
        // In Docker, the asterisk-config is mounted at /usr/src/asterisk-config
        this.dynamicConfigPath = process.env.NODE_ENV === 'development' && process.env.DOCKER_ENV === 'true'
            ? '/usr/src/asterisk-config/pjsip_dynamic.conf'
            : path.join(__dirname, '../asterisk-config/pjsip_dynamic.conf');
        this.agentTemplate = this.getAgentTemplate();
    }

    getAgentTemplate() {
        return `; Agent endpoint for user {USER_ID}
[agent_{USER_ID}]
type=endpoint
transport=transport-wss
context=manual-dialer-bridge
disallow=all
allow=ulaw,alaw,g722,opus
direct_media=no
rtp_symmetric=yes
force_rport=yes
rewrite_contact=yes
dtmf_mode=rfc4733
send_pai=yes
send_rpid=yes
trust_id_inbound=yes
trust_id_outbound=yes
ice_support=yes
use_avpf=yes
rtcp_mux=yes
rtp_timeout=60
rtp_timeout_hold=300
aors=agent_{USER_ID}_aor
auth=agent_{USER_ID}_auth

[agent_{USER_ID}_aor]
type=aor
max_contacts=1
qualify_frequency=30
qualify_timeout=3
remove_existing=yes
remove_unavailable=yes

[agent_{USER_ID}_auth]
type=auth
auth_type=userpass
username={SIP_USERNAME}
password={SIP_PASSWORD}

[agent_{USER_ID}_identify]
type=identify
endpoint=agent_{USER_ID}
match=0.0.0.0/0

`;
    }

    generateSipExtension(userId) {
        // Generate extension as 1000 + hash of userId (for UUIDs)
        const hash = crypto.createHash('md5').update(userId).digest('hex');
        const numericHash = parseInt(hash.substring(0, 8), 16);
        return (1000 + (numericHash % 9000)).toString(); // 1000-9999 range
    }

    generateSipCredentials() {
        // Generate secure random password
        const password = crypto.randomBytes(16).toString('hex');
        return password;
    }

    generateSipUsername(extension) {
        // Generate username as agent_{extension}
        return `agent_${extension}`;
    }

    async provisionAgentEndpoint(userId, extension, username, password) {
        try {
            logger.info(`Provisioning SIP endpoint for user ${userId}, extension ${extension}`);

            // Read existing dynamic config
            let config = '';
            try {
                config = await fs.readFile(this.dynamicConfigPath, 'utf8');
            } catch (error) {
                // File doesn't exist, create it
                logger.info('Creating new pjsip_dynamic.conf file');
                config = '; Dynamic PJSIP configuration for agents\n; Generated automatically - do not edit manually\n\n';
            }

            // Check if user endpoint already exists
            const userEndpointPattern = new RegExp(`\\[agent_${userId}\\][\\s\\S]*?(?=\\[|$)`);
            if (userEndpointPattern.test(config)) {
                logger.info(`SIP endpoint for user ${userId} already exists, updating...`);
                // Remove existing configuration
                config = config.replace(userEndpointPattern, '');
            }

            // Generate new configuration
            const userConfig = this.agentTemplate
                .replace(/{USER_ID}/g, userId)
                .replace(/{SIP_USERNAME}/g, username)
                .replace(/{SIP_PASSWORD}/g, password);

            // Append new configuration
            config += userConfig;

            // Write updated configuration
            await fs.writeFile(this.dynamicConfigPath, config, 'utf8');
            logger.info(`SIP endpoint configuration written for user ${userId}`);

            // Reload Asterisk PJSIP configuration
            await this.reloadAsteriskPjsip();

            return {
                success: true,
                extension,
                username,
                password,
                configPath: this.dynamicConfigPath
            };

        } catch (error) {
            logger.error(`Failed to provision SIP endpoint for user ${userId}:`, error);
            throw error;
        }
    }

    async reloadAsteriskPjsip() {
        try {
            // Make ARI call to reload PJSIP configuration
            const ARI_URL = process.env.ARI_URL || 'http://localhost:8088/ari';
            const ARI_USER = process.env.ARI_USERNAME || process.env.ARI_USER || 'ai-dialer';
            const ARI_PASS = process.env.ARI_PASSWORD || process.env.ARI_PASS || 'ai-dialer-password';

            const response = await fetch(`${ARI_URL}/asterisk/modules/pjsip`, {
                method: 'POST',
                headers: {
                    'Authorization': 'Basic ' + Buffer.from(`${ARI_USER}:${ARI_PASS}`).toString('base64'),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    module: 'res_pjsip.so',
                    action: 'reload'
                })
            });

            if (!response.ok) {
                throw new Error(`Failed to reload PJSIP: ${response.status} ${response.statusText}`);
            }

            logger.info('✅ Asterisk PJSIP configuration reloaded');

        } catch (error) {
            logger.error('❌ Failed to reload Asterisk PJSIP configuration:', error);
            // Don't throw error here as the configuration is still written
            // The reload can be done manually if needed
        }
    }

    async deprovisionAgentEndpoint(userId) {
        try {
            logger.info(`Deprovisioning SIP endpoint for user ${userId}`);

            // Read existing dynamic config
            let config = '';
            try {
                config = await fs.readFile(this.dynamicConfigPath, 'utf8');
            } catch (error) {
                logger.warn('Dynamic config file not found, nothing to deprovision');
                return { success: true };
            }

            // Remove user endpoint configuration
            const userEndpointPattern = new RegExp(`\\[agent_${userId}\\][\\s\\S]*?(?=\\[|$)`);
            const originalLength = config.length;
            config = config.replace(userEndpointPattern, '');

            if (config.length === originalLength) {
                logger.warn(`No SIP endpoint found for user ${userId}`);
                return { success: true };
            }

            // Write updated configuration
            await fs.writeFile(this.dynamicConfigPath, config, 'utf8');
            logger.info(`SIP endpoint configuration removed for user ${userId}`);

            // Reload Asterisk PJSIP configuration
            await this.reloadAsteriskPjsip();

            return { success: true };

        } catch (error) {
            logger.error(`Failed to deprovision SIP endpoint for user ${userId}:`, error);
            throw error;
        }
    }

    async getAgentSipConfig(userId) {
        try {
            // Read existing dynamic config
            let config = '';
            try {
                config = await fs.readFile(this.dynamicConfigPath, 'utf8');
            } catch (error) {
                return null;
            }

            // Extract user configuration
            const userEndpointPattern = new RegExp(`\\[agent_${userId}\\][\\s\\S]*?(?=\\[|$)`);
            const match = config.match(userEndpointPattern);

            if (!match) {
                return null;
            }

            const userConfig = match[0];

            // Extract username and password
            const usernameMatch = userConfig.match(/username=([^\s\n]+)/);
            const passwordMatch = userConfig.match(/password=([^\s\n]+)/);

            if (!usernameMatch || !passwordMatch) {
                return null;
            }

            const extension = this.generateSipExtension(userId);
            const username = usernameMatch[1];
            const password = passwordMatch[1];

            return {
                extension,
                username,
                password,
                server: process.env.ASTERISK_HOST || 'localhost',
                port: process.env.ASTERISK_WSS_PORT || '8089',
                transport: 'wss'
            };

        } catch (error) {
            logger.error(`Failed to get SIP config for user ${userId}:`, error);
            return null;
        }
    }

    async listProvisionedAgents() {
        try {
            // Read existing dynamic config
            let config = '';
            try {
                config = await fs.readFile(this.dynamicConfigPath, 'utf8');
            } catch (error) {
                return [];
            }

            // Find all agent endpoints
            const agentPattern = /\[agent_(\d+)\]/g;
            const agents = [];
            let match;

            while ((match = agentPattern.exec(config)) !== null) {
                const userId = match[1];
                const extension = this.generateSipExtension(userId);
                agents.push({
                    userId: parseInt(userId),
                    extension,
                    username: `agent_${extension}`
                });
            }

            return agents;

        } catch (error) {
            logger.error('Failed to list provisioned agents:', error);
            return [];
        }
    }

    // Utility method to check if dynamic config file exists
    async configFileExists() {
        try {
            await fs.access(this.dynamicConfigPath);
            return true;
        } catch (error) {
            return false;
        }
    }

    // Utility method to get config file path
    getConfigFilePath() {
        return this.dynamicConfigPath;
    }
}

module.exports = new SipProvisioningService();
