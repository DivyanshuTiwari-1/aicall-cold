const express = require('express');
const Joi = require('joi');
const { query } = require('../config/database');
const logger = require('../utils/logger');
const cron = require('node-cron');

const router = express.Router();

// Automated Call Queue System
class AutomatedCallQueue {
    constructor() {
        this.activeQueues = new Map(); // Key: agentId, Value: queue state
        this.callPacing = new Map();
        this.isRunning = false;
        this.maxConcurrentCalls = parseInt(process.env.MAX_CONCURRENT_CALLS) || 5;
        this.callInterval = parseInt(process.env.CALL_INTERVAL_MS) || 30000; // 30 seconds between calls
        this.retryAttempts = parseInt(process.env.MAX_RETRY_ATTEMPTS) || 3;
        this.retryDelay = parseInt(process.env.RETRY_DELAY_MS) || 300000; // 5 minutes
    }

    async startQueue(agentId, campaignId = null, phoneNumberId = null, phoneNumber = null) {
        try {
            // Handle both agent-specific and campaign-wide queues
            const queueKey = campaignId || agentId;

            if (this.activeQueues.has(queueKey)) {
                logger.warn(`Queue already active for ${campaignId ? 'campaign' : 'agent'} ${queueKey}`);
                return;
            }

            // Get campaign details if campaignId provided
            let campaign = null;
            if (campaignId) {
                campaign = await this.getCampaignDetails(campaignId);
                if (!campaign) {
                    throw new Error('Campaign not found');
                }
                if (campaign.status !== 'active') {
                    throw new Error('Campaign is not active');
                }
            }

            // For agent-specific queues, verify assigned leads
            let assignedLeads = [];
            if (agentId && campaignId) {
                assignedLeads = await this.getAgentAssignedLeads(agentId, campaignId);
                if (assignedLeads.length === 0) {
                    throw new Error('No assigned leads found for agent');
                }
            } else if (campaignId) {
                // For campaign-wide queues, get all contacts in campaign
                const result = await query(`
                    SELECT * FROM contacts
                    WHERE campaign_id = $1
                    AND status IN ('pending', 'retry', 'new')
                    ORDER BY created_at ASC
                `, [campaignId]);
                assignedLeads = result.rows;
            }

            // Initialize queue state
            this.activeQueues.set(queueKey, {
                agentId: agentId || null,
                campaignId: campaignId,
                phoneNumberId: phoneNumberId,
                phoneNumber: phoneNumber,
                status: 'running',
                startTime: new Date(),
                totalContacts: assignedLeads.length,
                processedContacts: 0,
                successfulCalls: 0,
                failedCalls: 0,
                lastCallTime: null,
                nextCallTime: new Date(),
                settings: campaign?.settings || {}
            });

            // Start the queue processing
            this.processQueue(queueKey);
            logger.info(`Automated queue started for ${campaignId ? 'campaign' : 'agent'} ${queueKey}`);
        } catch (error) {
            logger.error(`Failed to start queue for ${campaignId ? 'campaign' : 'agent'} ${agentId || campaignId}:`, error);
            throw error;
        }
    }

    async stopQueue(queueKey) {
        if (this.activeQueues.has(queueKey)) {
            this.activeQueues.delete(queueKey);
            logger.info(`Queue stopped for ${queueKey}`);
        }
    }

    async processQueue(queueKey) {
        const queue = this.activeQueues.get(queueKey);
        if (!queue || queue.status !== 'running') {
            return;
        }

        try {
            // Check if we should make a call now
            const now = new Date();
            if (now < queue.nextCallTime) {
                // Schedule next check
                setTimeout(() => this.processQueue(queueKey), 1000);
                return;
            }

            // Get next contact to call
            const contact = await this.getNextContact(queue.campaignId);
            if (!contact) {
                logger.info(`No more contacts to call for ${queue.agentId ? 'agent' : 'campaign'} ${queueKey}`);
                await this.stopQueue(queueKey);
                return;
            }

            // Check concurrent call limits
            const activeCalls = await this.getActiveCallCount();
            if (activeCalls >= this.maxConcurrentCalls) {
                // Wait and retry
                setTimeout(() => this.processQueue(queueKey), 5000);
                return;
            }

            // Check daily limit before making next call
            if (queue.phoneNumberId) {
                const limitCheck = await query(`
                    SELECT calls_made_today, daily_limit
                    FROM agent_phone_numbers
                    WHERE phone_number_id = $1
                `, [queue.phoneNumberId]);

                if (limitCheck.rows.length > 0) {
                    const { calls_made_today, daily_limit } = limitCheck.rows[0];
                    if (calls_made_today >= daily_limit) {
                        logger.warn(`Daily limit reached for phone number, stopping queue ${queueKey}`);
                        await this.stopQueue(queueKey);
                        return;
                    }
                }
            }

            // Make the call
            await this.initiateCall(queue.campaignId, contact, queue);

            // Update queue state
            queue.processedContacts++;
            queue.lastCallTime = new Date();
            queue.nextCallTime = new Date(now.getTime() + this.callInterval);

            // Schedule next call
            setTimeout(() => this.processQueue(queueKey), this.callInterval);

        } catch (error) {
            logger.error(`Error processing queue for ${queue.agentId ? 'agent' : 'campaign'} ${queueKey}:`, error);
            // Wait before retrying
            setTimeout(() => this.processQueue(queueKey), 30000);
        }
    }

    async getNextContact(campaignId) {
        try {
            const result = await query(`
                SELECT ct.*, c.name as campaign_name
                FROM contacts ct
                JOIN campaigns c ON ct.campaign_id = c.id
                LEFT JOIN dnc_registry dnc ON ct.phone = dnc.phone AND ct.organization_id = dnc.organization_id
                WHERE ct.campaign_id = $1
                AND ct.status IN ('pending', 'retry', 'new')
                AND (ct.last_contacted IS NULL OR ct.last_contacted < NOW() - INTERVAL '1 hour')
                AND ct.retry_count < $2
                AND dnc.id IS NULL
                ORDER BY
                    CASE WHEN ct.status = 'retry' THEN 1 ELSE 2 END,
                    ct.priority DESC,
                    ct.created_at ASC
                LIMIT 1
            `, [campaignId, this.retryAttempts]);

            if (result.rows[0]) {
                logger.info(`Selected contact ${result.rows[0].id} (${result.rows[0].phone}) for calling - status: ${result.rows[0].status}`);
            } else {
                logger.warn(`No contacts available for campaign ${campaignId} with status in ('pending', 'retry', 'new') that are not on DNC list`);
            }

            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error getting next contact:', error);
            return null;
        }
    }

    async initiateCall(campaignId, contact, queue) {
        try {
            const { startOutboundCall } = require('./telephony');

            // Double-check DNC status before initiating call
            const dncCheck = await query(
                'SELECT id FROM dnc_registry WHERE organization_id = $1 AND phone = $2',
                [contact.organization_id, contact.phone]
            );

            if (dncCheck.rows.length > 0) {
                logger.warn(`⚠️ Contact ${contact.id} (${contact.phone}) is on DNC list. Skipping call.`);
                // Mark contact as DNC
                await query(`
                    UPDATE contacts
                    SET status = 'dnc',
                        last_contacted = CURRENT_TIMESTAMP
                    WHERE id = $1
                `, [contact.id]);
                throw new Error('Contact is on Do Not Call list');
            }

            // Generate unique call ID
            const callId = `auto_${Date.now()}_${contact.id}`;

            // Create call record BEFORE initiating to ensure it exists in database
            const callResult = await query(`
                INSERT INTO calls (
                    id, organization_id, campaign_id, contact_id,
                    status, cost, call_type, from_number, created_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
                RETURNING *
            `, [
                callId,
                contact.organization_id,
                campaignId,
                contact.id,
                'initiated',
                0.0045,
                'automated',
                queue.phoneNumber || null
            ]);

            const call = callResult.rows[0];

            // Log call initiation event
            await query(`
                INSERT INTO call_events (call_id, event_type, event_data)
                VALUES ($1, $2, $3)
            `, [call.id, 'call_initiated', JSON.stringify({
                contact_id: contact.id,
                contact_name: `${contact.first_name} ${contact.last_name}`,
                contact_phone: contact.phone,
                campaign_id: campaignId,
                automated: true,
                timestamp: new Date().toISOString()
            })]);

            // Now initiate the actual call via telephony provider
            const providerResult = await startOutboundCall({
                callId: call.id,
                organizationId: contact.organization_id,
                campaignId: campaignId,
                contactId: contact.id,
                toPhone: contact.phone,
                fromNumber: queue.phoneNumber,
                automated: true
            });

            // Don't update contact status here - it will be updated when call completes
            // This prevents marking contacts as 'contacted' if the call fails immediately
            // The contact status will be updated in /call-ended based on actual outcome

            // Only update last_contacted timestamp to track the attempt
            await query(`
                UPDATE contacts
                SET last_contacted = CURRENT_TIMESTAMP
                WHERE id = $1
            `, [contact.id]);

            // Increment daily call counter for the phone number
            if (queue.phoneNumberId) {
                await query(`
                    UPDATE agent_phone_numbers
                    SET calls_made_today = calls_made_today + 1,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE phone_number_id = $1
                `, [queue.phoneNumberId]);
            }

            logger.info(`✅ Automated call initiated for ${contact.first_name} ${contact.last_name} (${contact.phone}), Call ID: ${call.id}`);

            return {
                ...providerResult,
                callId: call.id,
                contactName: `${contact.first_name} ${contact.last_name}`
            };

        } catch (error) {
            logger.error(`❌ Failed to initiate call for contact ${contact.id} (${contact.phone}):`, error.message);

            // Update contact retry count
            await query(`
                UPDATE contacts
                SET retry_count = retry_count + 1,
                    last_contacted = CURRENT_TIMESTAMP,
                    status = CASE WHEN retry_count + 1 >= $1 THEN 'failed' ELSE 'retry' END
                WHERE id = $2
            `, [this.retryAttempts, contact.id]);

            throw error;
        }
    }

    async getAgentAssignedLeads(agentId, campaignId) {
        try {
            const result = await query(`
                SELECT c.*, la.status as assignment_status, la.assigned_at
                FROM contacts c
                JOIN lead_assignments la ON c.id = la.contact_id
                WHERE la.assigned_to = $1
                AND c.campaign_id = $2
                AND la.status IN ('pending', 'in_progress')
                AND c.status IN ('new', 'retry_pending', 'pending')
                AND (la.expires_at IS NULL OR la.expires_at > NOW())
                ORDER BY la.assigned_at ASC
            `, [agentId, campaignId]);
            return result.rows;
        } catch (error) {
            logger.error('Error getting agent assigned leads:', error);
            return [];
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
        // Note: This monitoring is simplified since we track active queues in memory
        const result = await query(`
            SELECT id FROM campaigns
            WHERE status = 'active'
        `);

        // Only start queues that aren't already active
        for (const campaign of result.rows) {
            if (!callQueue.activeQueues.has(campaign.id)) {
                logger.info(`Auto-starting queue for campaign ${campaign.id}`);
                await callQueue.startQueue(null, campaign.id);
            }
        }
    } catch (error) {
        logger.error('Queue monitoring error:', error);
    }
});

// Cleanup stuck calls every 5 minutes
cron.schedule('*/5 * * * *', async() => {
    try {
        logger.info('Running stuck call cleanup job...');

        // Mark calls stuck in 'initiated' or 'in_progress' for > 15 minutes as failed
        const result = await query(`
            UPDATE calls
            SET
                status = 'failed',
                outcome = 'timeout',
                updated_at = CURRENT_TIMESTAMP
            WHERE status IN ('initiated', 'in_progress')
            AND created_at < NOW() - INTERVAL '15 minutes'
            RETURNING id, contact_id, created_at
        `);

        if (result.rows.length > 0) {
            logger.warn(`⚠️ Cleaned up ${result.rows.length} stuck calls`);

            // Update contacts for stuck calls to retry status
            for (const call of result.rows) {
                await query(`
                    UPDATE contacts
                    SET status = 'retry',
                        retry_count = retry_count + 1
                    WHERE id = $1
                `, [call.contact_id]);
            }
        }
    } catch (error) {
        logger.error('Stuck call cleanup error:', error);
    }
});

// API Routes for Queue Management
router.post('/start/:campaignId', async(req, res) => {
    try {
        const { campaignId } = req.params;
        await callQueue.startQueue(null, campaignId);

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
