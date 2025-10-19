const express = require('express');
const Joi = require('joi');
const { query } = require('../config/database');
const logger = require('../utils/logger');
const cron = require('node-cron');

const router = express.Router();

// Automated Call Queue System
class AutomatedCallQueue {
    constructor() {
        this.activeQueues = new Map();
        this.callPacing = new Map();
        this.isRunning = false;
        this.maxConcurrentCalls = parseInt(process.env.MAX_CONCURRENT_CALLS) || 5;
        this.callInterval = parseInt(process.env.CALL_INTERVAL_MS) || 30000; // 30 seconds between calls
        this.retryAttempts = parseInt(process.env.MAX_RETRY_ATTEMPTS) || 3;
        this.retryDelay = parseInt(process.env.RETRY_DELAY_MS) || 300000; // 5 minutes
    }

    async startQueue(campaignId) {
        try {
            if (this.activeQueues.has(campaignId)) {
                logger.warn(`Queue already active for campaign ${campaignId}`);
                return;
            }

            const campaign = await this.getCampaignDetails(campaignId);
            if (!campaign) {
                throw new Error('Campaign not found');
            }

            if (campaign.status !== 'active') {
                throw new Error('Campaign is not active');
            }

            // Initialize queue state
            this.activeQueues.set(campaignId, {
                campaignId,
                status: 'running',
                startTime: new Date(),
                totalContacts: 0,
                processedContacts: 0,
                successfulCalls: 0,
                failedCalls: 0,
                lastCallTime: null,
                nextCallTime: new Date(),
                settings: campaign.settings || {}
            });

            // Start the queue processing
            this.processQueue(campaignId);
            logger.info(`Automated queue started for campaign ${campaignId}`);
        } catch (error) {
            logger.error(`Failed to start queue for campaign ${campaignId}:`, error);
            throw error;
        }
    }

    async stopQueue(campaignId) {
        if (this.activeQueues.has(campaignId)) {
            this.activeQueues.delete(campaignId);
            logger.info(`Queue stopped for campaign ${campaignId}`);
        }
    }

    async processQueue(campaignId) {
        const queue = this.activeQueues.get(campaignId);
        if (!queue || queue.status !== 'running') {
            return;
        }

        try {
            // Check if we should make a call now
            const now = new Date();
            if (now < queue.nextCallTime) {
                // Schedule next check
                setTimeout(() => this.processQueue(campaignId), 1000);
                return;
            }

            // Get next contact to call
            const contact = await this.getNextContact(campaignId);
            if (!contact) {
                logger.info(`No more contacts to call for campaign ${campaignId}`);
                await this.stopQueue(campaignId);
                return;
            }

            // Check concurrent call limits
            const activeCalls = await this.getActiveCallCount();
            if (activeCalls >= this.maxConcurrentCalls) {
                // Wait and retry
                setTimeout(() => this.processQueue(campaignId), 5000);
                return;
            }

            // Make the call
            await this.initiateCall(campaignId, contact);

            // Update queue state
            queue.processedContacts++;
            queue.lastCallTime = new Date();
            queue.nextCallTime = new Date(now.getTime() + this.callInterval);

            // Schedule next call
            setTimeout(() => this.processQueue(campaignId), this.callInterval);

        } catch (error) {
            logger.error(`Error processing queue for campaign ${campaignId}:`, error);
            // Wait before retrying
            setTimeout(() => this.processQueue(campaignId), 30000);
        }
    }

    async getNextContact(campaignId) {
        try {
            const result = await query(`
                SELECT ct.*, c.name as campaign_name
                FROM contacts ct
                JOIN campaigns c ON ct.campaign_id = c.id
                WHERE ct.campaign_id = $1
                AND ct.status IN ('pending', 'retry')
                AND (ct.last_contacted IS NULL OR ct.last_contacted < NOW() - INTERVAL '1 hour')
                AND ct.retry_count < $2
                ORDER BY
                    CASE WHEN ct.status = 'retry' THEN 1 ELSE 2 END,
                    ct.priority DESC,
                    ct.created_at ASC
                LIMIT 1
            `, [campaignId, this.retryAttempts]);

            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error getting next contact:', error);
            return null;
        }
    }

    async initiateCall(campaignId, contact) {
        try {
            const { startOutboundCall } = require('./telephony');

            const callResult = await startOutboundCall({
                callId: `auto_${Date.now()}_${contact.id}`,
                organizationId: contact.organization_id,
                campaignId: campaignId,
                contactId: contact.id,
                toPhone: contact.phone,
                automated: true
            });

            // Log the call initiation
            await query(`
                INSERT INTO calls (organization_id, campaign_id, contact_id, status, cost, automated)
                VALUES ($1, $2, $3, $4, $5, $6)
            `, [
                contact.organization_id,
                campaignId,
                contact.id,
                'initiated',
                0.0045,
                true
            ]);

            logger.info(`Automated call initiated for contact ${contact.id}`);
            return callResult;

        } catch (error) {
            logger.error(`Failed to initiate call for contact ${contact.id}:`, error);

            // Update contact retry count
            await query(`
                UPDATE contacts
                SET retry_count = retry_count + 1,
                    last_contacted = CURRENT_TIMESTAMP,
                    status = CASE WHEN retry_count >= $1 THEN 'failed' ELSE 'retry' END
                WHERE id = $2
            `, [this.retryAttempts, contact.id]);

            throw error;
        }
    }

    async getCampaignDetails(campaignId) {
        try {
            const result = await query(`
                SELECT c.*, COUNT(ct.id) as contact_count
                FROM campaigns c
                LEFT JOIN contacts ct ON c.id = ct.campaign_id
                WHERE c.id = $1
                GROUP BY c.id
            `, [campaignId]);

            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error getting campaign details:', error);
            return null;
        }
    }

    async getActiveCallCount() {
        try {
            const result = await query(`
                SELECT COUNT(*) as count
                FROM calls
                WHERE status IN ('initiated', 'in_progress')
                AND created_at > NOW() - INTERVAL '10 minutes'
            `);
            return parseInt(result.rows[0].count);
        } catch (error) {
            logger.error('Error getting active call count:', error);
            return 0;
        }
    }

    getQueueStatus(campaignId) {
        return this.activeQueues.get(campaignId) || null;
    }

    getAllQueueStatuses() {
        return Array.from(this.activeQueues.values());
    }
}

// Global queue instance
const callQueue = new AutomatedCallQueue();

// Start queue monitoring cron job
cron.schedule('*/30 * * * * *', async() => {
    try {
        // Check for campaigns that should be running but aren't
        const result = await query(`
            SELECT id FROM campaigns
            WHERE status = 'active'
            AND id NOT IN (SELECT campaign_id FROM call_queue_status WHERE status = 'running')
        `);

        for (const campaign of result.rows) {
            await callQueue.startQueue(campaign.id);
        }
    } catch (error) {
        logger.error('Queue monitoring error:', error);
    }
});

// API Routes for Queue Management
router.post('/start/:campaignId', async(req, res) => {
    try {
        const { campaignId } = req.params;
        await callQueue.startQueue(campaignId);

        res.json({
            success: true,
            message: 'Queue started successfully',
            campaignId
        });
    } catch (error) {
        logger.error('Queue start error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

router.post('/stop/:campaignId', async(req, res) => {
    try {
        const { campaignId } = req.params;
        await callQueue.stopQueue(campaignId);

        res.json({
            success: true,
            message: 'Queue stopped successfully',
            campaignId
        });
    } catch (error) {
        logger.error('Queue stop error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

router.get('/status/:campaignId', async(req, res) => {
    try {
        const { campaignId } = req.params;
        const status = callQueue.getQueueStatus(campaignId);

        res.json({
            success: true,
            status: status || { status: 'stopped' }
        });
    } catch (error) {
        logger.error('Queue status error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

router.get('/status', async(req, res) => {
    try {
        const allStatuses = callQueue.getAllQueueStatuses();

        res.json({
            success: true,
            queues: allStatuses
        });
    } catch (error) {
        logger.error('All queue status error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

module.exports = { router, callQueue };