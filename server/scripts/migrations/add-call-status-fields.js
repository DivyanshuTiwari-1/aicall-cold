const { query } = require('../../config/database');
const logger = require('../../utils/logger');

/**
 * Migration: Add call status and tracking fields
 * - from_number: Track which number initiated the call
 * - to_number: Track customer's phone number
 * - channel_id: Track Asterisk channel for active calls
 * - Add indexes for performance
 */

async function addCallStatusFields() {
    try {
        logger.info('Running migration: add-call-status-fields');

        // Add from_number field (caller ID used)
        try {
            await query(`
                ALTER TABLE calls
                ADD COLUMN IF NOT EXISTS from_number VARCHAR(20)
            `);
            logger.info('✅ Added from_number field to calls table');
        } catch (error) {
            logger.warn('from_number field may already exist:', error.message);
        }

        // Add to_number field (customer's phone)
        try {
            await query(`
                ALTER TABLE calls
                ADD COLUMN IF NOT EXISTS to_number VARCHAR(20)
            `);
            logger.info('✅ Added to_number field to calls table');
        } catch (error) {
            logger.warn('to_number field may already exist:', error.message);
        }

        // Add channel_id field (Asterisk channel identifier)
        try {
            await query(`
                ALTER TABLE calls
                ADD COLUMN IF NOT EXISTS channel_id VARCHAR(100)
            `);
            logger.info('✅ Added channel_id field to calls table');
        } catch (error) {
            logger.warn('channel_id field may already exist:', error.message);
        }

        // Add index on call_events for faster conversation queries
        try {
            await query(`
                CREATE INDEX IF NOT EXISTS idx_call_events_call_type_time
                ON call_events(call_id, event_type, timestamp DESC)
            `);
            logger.info('✅ Added index on call_events for conversation queries');
        } catch (error) {
            logger.warn('Index may already exist:', error.message);
        }

        // Add index on calls for active call queries
        try {
            await query(`
                CREATE INDEX IF NOT EXISTS idx_calls_status_created
                ON calls(status, created_at DESC)
            `);
            logger.info('✅ Added index on calls for active call queries');
        } catch (error) {
            logger.warn('Index may already exist:', error.message);
        }

        // Add index on calls for organization queries
        try {
            await query(`
                CREATE INDEX IF NOT EXISTS idx_calls_org_status
                ON calls(organization_id, status)
            `);
            logger.info('✅ Added index on calls for organization filtering');
        } catch (error) {
            logger.warn('Index may already exist:', error.message);
        }

        logger.info('✅ Migration completed: add-call-status-fields');
        return true;

    } catch (error) {
        logger.error('❌ Migration failed: add-call-status-fields', error);
        throw error;
    }
}

// Run migration if called directly
if (require.main === module) {
    addCallStatusFields()
        .then(() => {
            logger.info('Migration executed successfully');
            process.exit(0);
        })
        .catch((error) => {
            logger.error('Migration failed:', error);
            process.exit(1);
        });
}

module.exports = addCallStatusFields;
