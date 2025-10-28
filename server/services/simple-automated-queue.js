const { query } = require('../config/database');
const logger = require('../utils/logger');
const telnyxCallControl = require('./telnyx-call-control');
const WebSocketBroadcaster = require('./websocket-broadcaster');

/**
 * Simple Automated Call Queue
 * Simplified version of queue.js - just basic iteration through contacts
 * No complex pacing, retry logic, or concurrent limits
 */

class SimpleAutomatedQueue {
    constructor() {
        this.activeQueues = new Map(); // campaignId -> queue state
        this.callDelay = 5000; // 5 seconds between calls
    }

    /**
     * Start queue for a campaign
     */
    async startQueue(campaignId, phoneNumberId, phoneNumber) {
        try {
            if (this.activeQueues.has(campaignId)) {
                logger.warn(`Queue already active for campaign ${campaignId}`);
                return { success: false, message: 'Queue already running' };
            }

            // Get campaign details
            const campaignResult = await query(`
                SELECT * FROM campaigns WHERE id = $1
            `, [campaignId]);

            if (campaignResult.rows.length === 0) {
                throw new Error('Campaign not found');
            }

            const campaign = campaignResult.rows[0];

            if (campaign.status !== 'active') {
                throw new Error('Campaign is not active');
            }

            // Count available contacts
            const contactCount = await this.getAvailableContactCount(campaignId);

            if (contactCount === 0) {
                throw new Error('No contacts available for calling');
            }

            // Initialize queue state
            const queueState = {
                campaignId,
                phoneNumberId,
                phoneNumber,
                organizationId: campaign.organization_id,
                status: 'running',
                startTime: new Date(),
                totalContacts: contactCount,
                processedContacts: 0,
                successfulCalls: 0,
                failedCalls: 0
            };

            this.activeQueues.set(campaignId, queueState);

            logger.info(`✅ Queue started for campaign ${campaignId} - ${contactCount} contacts available`);

            // Start processing
            this.processNextContact(campaignId);

            return {
                success: true,
                message: 'Queue started successfully',
                queueState
            };

        } catch (error) {
            logger.error(`Failed to start queue for campaign ${campaignId}:`, error);
            throw error;
        }
    }

    /**
     * Stop queue for a campaign
     */
    async stopQueue(campaignId) {
        if (!this.activeQueues.has(campaignId)) {
            return { success: false, message: 'Queue not running' };
        }

        this.activeQueues.delete(campaignId);
        logger.info(`⏹️  Queue stopped for campaign ${campaignId}`);

        return { success: true, message: 'Queue stopped successfully' };
    }

    /**
     * Process next contact in queue
     */
    async processNextContact(campaignId) {
        const queueState = this.activeQueues.get(campaignId);

        if (!queueState || queueState.status !== 'running') {
            return;
        }

        try {
            // Get next contact
            const contact = await this.getNextContact(campaignId);

            if (!contact) {
                logger.info(`No more contacts available for campaign ${campaignId}`);
                await this.stopQueue(campaignId);
                return;
            }

            // Check DNC list
            const isOnDNC = await this.checkDNC(contact.phone, queueState.organizationId);

            if (isOnDNC) {
                logger.warn(`⚠️  Contact ${contact.id} is on DNC list, skipping`);

                // Mark contact as DNC
                await query(`
                    UPDATE contacts
                    SET status = 'dnc', updated_at = CURRENT_TIMESTAMP
                    WHERE id = $1
                `, [contact.id]);

                queueState.processedContacts++;

                // Move to next contact immediately
                setTimeout(() => this.processNextContact(campaignId), 1000);
                return;
            }

            // Initiate call
            await this.initiateCall(contact, queueState);

            queueState.processedContacts++;

            // Schedule next contact processing after delay
            setTimeout(() => this.processNextContact(campaignId), this.callDelay);

        } catch (error) {
            logger.error(`Error processing contact for campaign ${campaignId}:`, error);
            queueState.failedCalls++;

            // Continue with next contact after delay
            setTimeout(() => this.processNextContact(campaignId), this.callDelay);
        }
    }

    /**
     * Get next contact to call
     */
    async getNextContact(campaignId) {
        try {
            const result = await query(`
                SELECT * FROM contacts
                WHERE campaign_id = $1
                AND status IN ('pending', 'new')
                ORDER BY priority DESC, created_at ASC
                LIMIT 1
            `, [campaignId]);

            return result.rows[0] || null;

        } catch (error) {
            logger.error('Error getting next contact:', error);
            return null;
        }
    }

    /**
     * Get available contact count
     */
    async getAvailableContactCount(campaignId) {
        try {
            const result = await query(`
                SELECT COUNT(*) as count FROM contacts
                WHERE campaign_id = $1
                AND status IN ('pending', 'new')
            `, [campaignId]);

            return parseInt(result.rows[0].count);

        } catch (error) {
            logger.error('Error counting contacts:', error);
            return 0;
        }
    }

    /**
     * Check if phone number is on DNC list
     */
    async checkDNC(phone, organizationId) {
        try {
            const result = await query(`
                SELECT id FROM dnc_registry
                WHERE organization_id = $1 AND phone = $2
            `, [organizationId, phone]);

            return result.rows.length > 0;

        } catch (error) {
            logger.error('Error checking DNC:', error);
            return false; // Fail open - allow call if DNC check fails
        }
    }

    /**
     * Initiate call for contact
     */
    async initiateCall(contact, queueState) {
        const { v4: uuidv4 } = require('uuid');
        const callId = uuidv4();

        try {
            // Create call record in database
            await query(`
                INSERT INTO calls (
                    id, organization_id, campaign_id, contact_id,
                    status, call_type, from_number, to_number, cost, created_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
            `, [
                callId,
                queueState.organizationId,
                queueState.campaignId,
                contact.id,
                'initiated',
                'automated',
                queueState.phoneNumber,
                contact.phone,
                0.0 // Will be calculated on call end
            ]);

            // Broadcast call started
            WebSocketBroadcaster.broadcastCallStarted(queueState.organizationId, {
                callId,
                contactId: contact.id,
                campaignId: queueState.campaignId,
                phoneNumber: contact.phone,
                fromNumber: queueState.phoneNumber,
                contactName: `${contact.first_name} ${contact.last_name}`,
                automated: true
            });

            // Log call initiation event
            await query(`
                INSERT INTO call_events (call_id, event_type, event_data)
                VALUES ($1, $2, $3)
            `, [
                callId,
                'call_initiated',
                JSON.stringify({
                    contact_id: contact.id,
                    contact_name: `${contact.first_name} ${contact.last_name}`,
                    phone: contact.phone,
                    campaign_id: queueState.campaignId,
                    automated: true,
                    timestamp: new Date().toISOString()
                })
            ]);

            // Initiate call via Telnyx
            const result = await telnyxCallControl.makeAICall({
                callId,
                contact,
                campaignId: queueState.campaignId,
                fromNumber: queueState.phoneNumber
            });

            // Update last_contacted timestamp
            await query(`
                UPDATE contacts
                SET last_contacted = CURRENT_TIMESTAMP
                WHERE id = $1
            `, [contact.id]);

            logger.info(`✅ Call initiated: ${callId} to ${contact.first_name} ${contact.last_name} (${contact.phone})`);

            queueState.successfulCalls++;

            return result;

        } catch (error) {
            logger.error(`❌ Failed to initiate call for contact ${contact.id}:`, error);

            // Update call status to failed if it was created
            await query(`
                UPDATE calls
                SET status = 'failed', outcome = 'failed', updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
            `, [callId]).catch(err => {
                logger.error('Failed to update call status:', err);
            });

            queueState.failedCalls++;
            throw error;
        }
    }

    /**
     * Get queue status
     */
    getQueueStatus(campaignId) {
        return this.activeQueues.get(campaignId) || null;
    }

    /**
     * Get all active queues
     */
    getAllQueueStatuses() {
        return Array.from(this.activeQueues.values());
    }
}

// Export singleton instance
module.exports = new SimpleAutomatedQueue();
