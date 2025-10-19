#!/usr/bin/env node

/**
 * Dynamic Agent SIP Endpoint Manager
 * Creates and manages SIP endpoints for agents in Asterisk
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);
const logger = require('../utils/logger');

class AgentSIPManager {
    constructor() {
        this.pjsipConfigPath = '/etc/asterisk/pjsip.conf';
        this.asteriskSocket = '/var/run/asterisk/asterisk.ctl';
    }

    /**
     * Add a new agent SIP endpoint
     */
    async addAgentEndpoint(agentData) {
        try {
            const { userId, extension, username, password, firstName, lastName } = agentData;

            // Generate SIP configuration
            const sipConfig = this.generateAgentSIPConfig(extension, username, password);

            // Add to pjsip.conf
            await this.addToPJSIPConfig(sipConfig);

            // Reload Asterisk configuration
            await this.reloadAsteriskConfig();

            logger.info(`Agent SIP endpoint added: ${extension} (${firstName} ${lastName})`);

            return {
                success: true,
                extension,
                username,
                endpoint: `PJSIP/${extension}`
            };

        } catch (error) {
            logger.error('Failed to add agent SIP endpoint:', error);
            throw error;
        }
    }

    /**
     * Remove an agent SIP endpoint
     */
    async removeAgentEndpoint(extension) {
        try {
            // Remove from pjsip.conf
            await this.removeFromPJSIPConfig(extension);

            // Reload Asterisk configuration
            await this.reloadAsteriskConfig();

            logger.info(`Agent SIP endpoint removed: ${extension}`);

            return { success: true, extension };

        } catch (error) {
            logger.error('Failed to remove agent SIP endpoint:', error);
            throw error;
        }
    }

    /**
     * Update agent SIP credentials
     */
    async updateAgentCredentials(extension, newPassword) {
        try {
            // Update password in pjsip.conf
            await this.updatePasswordInPJSIPConfig(extension, newPassword);

            // Reload Asterisk configuration
            await this.reloadAsteriskConfig();

            logger.info(`Agent SIP credentials updated: ${extension}`);

            return { success: true, extension };

        } catch (error) {
            logger.error('Failed to update agent SIP credentials:', error);
            throw error;
        }
    }

    /**
     * Generate SIP configuration for an agent
     */
    generateAgentSIPConfig(extension, username, password) {
        return `
; Agent ${extension} - ${username}
[${extension}](agent_template)
type=endpoint
auth=${extension}_auth
aors=${extension}_aor
callerid="Agent ${extension}" <${extension}>

[${extension}_aor](agent_aor_template)
type=aor

[${extension}_auth](agent_auth_template)
type=auth
username=${username}
password=${password}

[${extension}_identify](agent_identify_template)
type=identify
endpoint=${extension}
match=0.0.0.0/0
`;
    }

    /**
     * Add configuration to pjsip.conf
     */
    async addToPJSIPConfig(sipConfig) {
        try {
            // Read current config
            let config = fs.readFileSync(this.pjsipConfigPath, 'utf8');

            // Add new agent config before the end of file
            config += sipConfig;

            // Write back to file
            fs.writeFileSync(this.pjsipConfigPath, config);

        } catch (error) {
            throw new Error(`Failed to write to pjsip.conf: ${error.message}`);
        }
    }

    /**
     * Remove configuration from pjsip.conf
     */
    async removeFromPJSIPConfig(extension) {
        try {
            // Read current config
            let config = fs.readFileSync(this.pjsipConfigPath, 'utf8');

            // Remove agent-specific sections
            const lines = config.split('\n');
            const filteredLines = [];
            let skipSection = false;

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];

                // Check if this line starts a section for this extension
                if (line.match(new RegExp(`^\\[${extension}(_|$)`))) {
                    skipSection = true;
                    continue;
                }

                // Check if we're starting a new section (not for this extension)
                if (line.match(/^\[.*\]$/) && !line.match(new RegExp(`^\\[${extension}(_|$)`))) {
                    skipSection = false;
                }

                // Skip comment lines that belong to this extension
                if (skipSection && line.match(new RegExp(`^;.*${extension}`))) {
                    continue;
                }

                if (!skipSection) {
                    filteredLines.push(line);
                }
            }

            // Write back to file
            fs.writeFileSync(this.pjsipConfigPath, filteredLines.join('\n'));

        } catch (error) {
            throw new Error(`Failed to remove from pjsip.conf: ${error.message}`);
        }
    }

    /**
     * Update password in pjsip.conf
     */
    async updatePasswordInPJSIPConfig(extension, newPassword) {
        try {
            // Read current config
            let config = fs.readFileSync(this.pjsipConfigPath, 'utf8');

            // Replace password for this extension
            const passwordRegex = new RegExp(`(\\[${extension}_auth\\][\\s\\S]*?password=)[^\\n]*`, 'g');
            config = config.replace(passwordRegex, `$1${newPassword}`);

            // Write back to file
            fs.writeFileSync(this.pjsipConfigPath, config);

        } catch (error) {
            throw new Error(`Failed to update password in pjsip.conf: ${error.message}`);
        }
    }

    /**
     * Reload Asterisk configuration
     */
    async reloadAsteriskConfig() {
        try {
            // Reload pjsip module
            await execAsync(`asterisk -rx "module reload res_pjsip.so"`);

            // Reload pjsip configuration
            await execAsync(`asterisk -rx "pjsip reload"`);

            logger.info('Asterisk configuration reloaded');

        } catch (error) {
            throw new Error(`Failed to reload Asterisk config: ${error.message}`);
        }
    }

    /**
     * Get next available extension
     */
    async getNextAvailableExtension() {
        try {
            // Query Asterisk for existing extensions
            const { stdout } = await execAsync(`asterisk -rx "pjsip show endpoints"`);

            // Extract existing extensions (assuming they start with 1)
            const existingExtensions = stdout
                .split('\n')
                .filter(line => line.match(/^[0-9]+/))
                .map(line => parseInt(line.split(' ')[0]))
                .filter(ext => ext >= 1000 && ext <= 9999);

            // Find next available extension
            let extension = 1001;
            while (existingExtensions.includes(extension)) {
                extension++;
            }

            return extension;

        } catch (error) {
            logger.warn('Could not query existing extensions, using default:', error.message);
            return 1001; // Default starting extension
        }
    }

    /**
     * Check if extension is available
     */
    async isExtensionAvailable(extension) {
        try {
            const { stdout } = await execAsync(`asterisk -rx "pjsip show endpoint ${extension}"`);
            return stdout.includes('No such endpoint');
        } catch (error) {
            return true; // Assume available if we can't check
        }
    }

    /**
     * Generate secure password
     */
    generateSecurePassword(length = 12) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
        let password = '';

        for (let i = 0; i < length; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length));
        }

        return password;
    }

    /**
     * Test SIP endpoint connectivity
     */
    async testEndpoint(extension) {
        try {
            const { stdout } = await execAsync(`asterisk -rx "pjsip show endpoint ${extension}"`);

            if (stdout.includes('Contact:') && !stdout.includes('No such endpoint')) {
                return { success: true, status: 'registered' };
            } else {
                return { success: false, status: 'not_registered' };
            }

        } catch (error) {
            return { success: false, status: 'error', error: error.message };
        }
    }
}

module.exports = AgentSIPManager;