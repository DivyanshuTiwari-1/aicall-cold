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
        this.activeCalls = new Map(); // campaignId -> current active call info
        this.callDelay = 5000; // 5 seconds between calls (AFTER completion)
        // Track phone numbers currently being dialed/active across all campaigns to prevent duplicates
        this.inProgressNumbers = new Set();
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
            logger.info(`🎯 [QUEUE] Campaign ${campaignId}: Queue not running, stopping processing`);
            return;
        }

        // CRITICAL: Check if there's already an active call for this campaign
        // This ensures only one call processes at a time per campaign
        if (this.activeCalls.has(campaignId)) {
            const activeCall = this.activeCalls.get(campaignId);
            const waitTime = Math.floor((new Date() - activeCall.startTime) / 1000);
            logger.warn(`⚠️  [QUEUE] Campaign ${campaignId}: Active call in progress (callId: ${activeCall.callId}, wait: ${waitTime}s), waiting for completion`);
            logger.info(`🔒 [QUEUE] Campaign ${campaignId}: Sequential processing guard - preventing concurrent calls`);
            return; // Exit early - onCallCompleted will schedule next contact when current call finishes
        }

        try {
            logger.info(`🎯 [QUEUE] Campaign ${campaignId}: Processing next contact...`);

            // Get next contact
            const contact = await this.getNextContact(campaignId);

            if (!contact) {
                logger.info(`✅ [QUEUE] Campaign ${campaignId}: No more contacts available`);
                logger.info(`📊 [QUEUE] Final Stats - Processed: ${queueState.processedContacts}, Success: ${queueState.successfulCalls}, Failed: ${queueState.failedCalls}`);
                await this.stopQueue(campaignId);
                return;
            }

            logger.info(`🎯 [QUEUE] Campaign ${campaignId}: Found contact ${contact.id} - ${contact.first_name} ${contact.last_name} (${contact.phone})`);

            // Check DNC list
            const isOnDNC = await this.checkDNC(contact.phone, queueState.organizationId);

            if (isOnDNC) {
                logger.warn(`⚠️  [QUEUE] Contact ${contact.id} is on DNC list, skipping`);

                // Mark contact as DNC
                await query(`
                    UPDATE contacts
                    SET status = 'dnc', updated_at = CURRENT_TIMESTAMP
                    WHERE id = $1
                `, [contact.id]);

                queueState.processedContacts++;

                // Move to next contact immediately (no delay for skipped contacts)
                logger.info(`🎯 [QUEUE] Campaign ${campaignId}: Moving to next contact immediately`);
                setImmediate(() => this.processNextContact(campaignId));
                return;
            }

            // Guard: Prevent duplicate dials to the same phone number
            // 1) Skip immediately if number is already in-progress in memory
            const targetPhone = String(contact.phone).trim();
            if (this.inProgressNumbers.has(targetPhone)) {
                logger.warn(`⚠️  [QUEUE] Campaign ${campaignId}: Number ${targetPhone} already in progress elsewhere, skipping contact ${contact.id}`);
                // Try next contact right away
                setImmediate(() => this.processNextContact(campaignId));
                return;
            }

            // 2) Double-check against database for any active call to the same number
            const activeCallCheck = await query(`
                SELECT id FROM calls
                WHERE to_number = $1
                  AND status IN ('initiated','ringing','connected','in_progress')
                LIMIT 1
            `, [targetPhone]).catch(err => {
                logger.error('Error checking for active calls by number:', err);
                return { rows: [] };
            });

            if (activeCallCheck && activeCallCheck.rows && activeCallCheck.rows.length > 0) {
                logger.warn(`⚠️  [QUEUE] Campaign ${campaignId}: Active call already exists for ${targetPhone} (call ${activeCallCheck.rows[0].id}), skipping`);
                setImmediate(() => this.processNextContact(campaignId));
                return;
            }

            // Mark contact as in_progress to avoid being picked again by other workers
            try {
                await query(`
                    UPDATE contacts
                    SET status = 'in_progress', updated_at = CURRENT_TIMESTAMP,
                        attempts = COALESCE(attempts, 0) + 1
                    WHERE id = $1
                `, [contact.id]);
                logger.info(`🚦 [QUEUE] Campaign ${campaignId}: Marked contact ${contact.id} as in_progress`);
            } catch (markErr) {
                logger.error(`❌ [QUEUE] Campaign ${campaignId}: Failed to mark contact ${contact.id} in_progress:`, markErr);
            }

            // CRITICAL: Reserve slot IMMEDIATELY to prevent concurrent calls
            // This ensures only one call processes at a time per campaign and per phone number system-wide
            const { v4: uuidv4 } = require('uuid');
            const tempCallId = uuidv4();
            this.activeCalls.set(campaignId, {
                callId: tempCallId,
                contactId: contact.id,
                startTime: new Date(),
                status: 'reserved'
            });
            // Reserve number globally
            this.inProgressNumbers.add(targetPhone);

            logger.info(`🔒 [QUEUE] Campaign ${campaignId}: Reserved slot for contact ${contact.id} (preventing concurrent calls)`);

            // Initiate call
            const callResult = await this.initiateCall(contact, queueState);

            queueState.processedContacts++;

            // Update with real call ID - will be cleared by onCallCompleted
            this.activeCalls.set(campaignId, {
                callId: callResult.callId,
                contactId: contact.id,
                startTime: new Date(),
                status: 'active'
            });

            logger.info(`🎯 [QUEUE] Campaign ${campaignId}: Call initiated, waiting for completion...`);
            logger.info(`📊 [QUEUE] Progress: ${queueState.processedContacts}/${queueState.totalContacts} (${Math.round(queueState.processedContacts / queueState.totalContacts * 100)}%)`);

            // NOTE: Do NOT schedule next contact here!
            // Next contact will be processed when onCallCompleted() is called from webhook

        } catch (error) {
            logger.error(`❌ [QUEUE] Campaign ${campaignId}: Error processing contact:`, error);
            queueState.failedCalls++;

            // Mark contact for retry on failure (unless DNC)
            try {
                await query(`
                    UPDATE contacts
                    SET status = 'retry', updated_at = CURRENT_TIMESTAMP
                    WHERE id = $1 AND status != 'dnc'
                `, [contact?.id]);
                logger.info(`🔁 [QUEUE] Campaign ${campaignId}: Contact ${contact?.id} marked as retry`);
            } catch (_) {}

            // Clear active call slot and release number to allow next contact to process
            this.activeCalls.delete(campaignId);
            try { this.inProgressNumbers.delete(String(contact.phone).trim()); } catch (_) {}
            logger.info(`🔓 [QUEUE] Campaign ${campaignId}: Released slot due to error`);

            // Continue with next contact after delay even on error
            logger.info(`🎯 [QUEUE] Campaign ${campaignId}: Scheduling next contact after error (${this.callDelay}ms delay)`);
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
                AND status IN ('pending', 'new', 'retry')
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
                AND status IN ('pending', 'new', 'retry')
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
            logger.info(`📞 [CALL] ${callId}: Creating call record in database`);
            logger.info(`   Contact: ${contact.first_name} ${contact.last_name} (${contact.phone})`);
            logger.info(`   Campaign: ${queueState.campaignId}`);
            logger.info(`   From: ${queueState.phoneNumber}`);

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

            logger.info(`✅ [CALL] ${callId}: Database record created`);

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

            // Get campaign details including script_id
            const campaignResult = await query(`
                SELECT script_id, name, type, voice_persona
                FROM campaigns
                WHERE id = $1
            `, [queueState.campaignId]);

            const campaign = campaignResult.rows[0] || {};
            const scriptId = campaign.script_id || null;

            if (scriptId) {
                logger.info(`📝 [CALL] ${callId}: Campaign has script_id: ${scriptId}`);
            } else {
                logger.warn(`⚠️  [CALL] ${callId}: Campaign ${queueState.campaignId} has no script_id assigned. AI will use default greeting.`);
            }

            // Initiate call via Telnyx
            logger.info(`📞 [CALL] ${callId}: Initiating call via Telnyx...`);
            const result = await telnyxCallControl.makeAICall({
                callId,
                contact,
                campaignId: queueState.campaignId,
                fromNumber: queueState.phoneNumber,
                scriptId: scriptId // Pass script_id to Telnyx metadata
            });

            // Update last_contacted timestamp
            await query(`
                UPDATE contacts
                SET last_contacted = CURRENT_TIMESTAMP
                WHERE id = $1
            `, [contact.id]);

            logger.info(`✅ [CALL] ${callId}: Call initiated successfully to ${contact.first_name} ${contact.last_name} (${contact.phone})`);
            logger.info(`   Telnyx Call Control ID: ${result.callControlId}`);

            queueState.successfulCalls++;

            return {
                ...result,
                callId // Ensure callId is in the return value
            };

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
     * Called by webhook when a call completes
     * This triggers processing of the next contact after configured delay
     */
    async onCallCompleted(campaignId, callId, outcome) {
        logger.info(`📞 [QUEUE] Campaign ${campaignId}: Call ${callId} completed with outcome: ${outcome}`);

        const queueState = this.activeQueues.get(campaignId);
        const activeCall = this.activeCalls.get(campaignId);

        if (!queueState) {
            logger.warn(`⚠️  [QUEUE] Campaign ${campaignId}: Queue not found for completed call`);
            return;
        }

        if (activeCall) {
            const callDuration = Math.floor((new Date() - activeCall.startTime) / 1000);
            logger.info(`📞 [QUEUE] Campaign ${campaignId}: Active call duration: ${callDuration}s`);

            // Clear active call
            this.activeCalls.delete(campaignId);
            logger.info(`✅ [QUEUE] Campaign ${campaignId}: Active call cleared`);
        }

        // Release the phone number reservation for this completed call
        try {
            // Look up the completed call's number
            if (callId) {
                const callResult = await query(`SELECT to_number FROM calls WHERE id = $1`, [callId]);
                const num = callResult.rows?.[0]?.to_number;
                if (num) {
                    this.inProgressNumbers.delete(String(num).trim());
                    logger.info(`🔓 [QUEUE] Campaign ${campaignId}: Released number reservation for ${num}`);
                } else {
                    logger.warn(`⚠️  [QUEUE] Campaign ${campaignId}: Could not find call ${callId} to release number reservation`);
                }
            } else if (activeCall && activeCall.contactId) {
                // Fallback: try to get phone number from contact
                try {
                    const contactResult = await query(`SELECT phone FROM contacts WHERE id = $1`, [activeCall.contactId]);
                    if (contactResult.rows.length > 0) {
                        const num = contactResult.rows[0].phone;
                        this.inProgressNumbers.delete(String(num).trim());
                        logger.info(`🔓 [QUEUE] Campaign ${campaignId}: Released number reservation for ${num} (from contact)`);
                    }
                } catch (contactErr) {
                    logger.warn(`⚠️  [QUEUE] Campaign ${campaignId}: Could not release number from contact: ${contactErr.message}`);
                }
            }
        } catch (releaseErr) {
            logger.warn(`⚠️  [QUEUE] Campaign ${campaignId}: Error releasing number reservation: ${releaseErr.message}`);
        }

        // Update success/fail counts based on outcome
        if (outcome === 'completed' || outcome === 'scheduled' || outcome === 'interested' || outcome === 'answered') {
            // Already incremented in initiateCall
        } else if (outcome === 'no_answer' || outcome === 'busy' || outcome === 'failed' || outcome === 'voicemail') {
            queueState.failedCalls++;
        }

        // Mark contact as contacted or retry depending on outcome
        try {
            if (activeCall && activeCall.contactId) {
                if (['completed', 'scheduled', 'interested', 'answered', 'not_interested', 'dnc_request'].includes(outcome)) {
                    await query(`
                        UPDATE contacts
                        SET status = 'contacted', updated_at = CURRENT_TIMESTAMP
                        WHERE id = $1
                    `, [activeCall.contactId]);
                } else if (['no_answer', 'busy', 'failed', 'voicemail'].includes(outcome)) {
                    await query(`
                        UPDATE contacts
                        SET status = 'retry', updated_at = CURRENT_TIMESTAMP
                        WHERE id = $1
                    `, [activeCall.contactId]);
                }
            }
        } catch (e) {
            logger.warn(`⚠️  [QUEUE] Campaign ${campaignId}: Failed to update contact status post-call`);
        }

        // Broadcast queue status update
        WebSocketBroadcaster.broadcastToOrganization(queueState.organizationId, {
            type: 'queue_status_update',
            campaignId: campaignId,
            status: {
                totalContacts: queueState.totalContacts,
                processedContacts: queueState.processedContacts,
                successfulCalls: queueState.successfulCalls,
                failedCalls: queueState.failedCalls,
                remainingContacts: queueState.totalContacts - queueState.processedContacts,
                progress: Math.round((queueState.processedContacts / queueState.totalContacts) * 100)
            },
            timestamp: new Date().toISOString()
        });

        logger.info(`📊 [QUEUE] Campaign ${campaignId}: Stats - ${queueState.successfulCalls} success, ${queueState.failedCalls} failed, ${queueState.totalContacts - queueState.processedContacts} remaining`);

        // Schedule next contact after delay
        if (queueState.status === 'running') {
            logger.info(`🎯 [QUEUE] Campaign ${campaignId}: Scheduling next contact in ${this.callDelay}ms...`);
            setTimeout(() => {
                logger.info(`🎯 [QUEUE] Campaign ${campaignId}: Delay complete, processing next contact now`);
                this.processNextContact(campaignId);
            }, this.callDelay);
        } else {
            logger.info(`⏹️  [QUEUE] Campaign ${campaignId}: Queue stopped, not processing next contact`);
        }
    }

    /**
     * Get queue status
     */
    getQueueStatus(campaignId) {
        const queueState = this.activeQueues.get(campaignId);
        if (!queueState) return null;

        return {
            ...queueState,
            activeCall: this.activeCalls.get(campaignId) || null,
            remainingContacts: queueState.totalContacts - queueState.processedContacts
        };
    }

    /**
     * Get all active queues
     */
    getAllQueueStatuses() {
        return Array.from(this.activeQueues.entries()).map(([campaignId, state]) => ({
            campaignId,
            ...state,
            activeCall: this.activeCalls.get(campaignId) || null,
            remainingContacts: state.totalContacts - state.processedContacts
        }));
    }
}

// Export singleton instance
module.exports = new SimpleAutomatedQueue();
