const { query } = require('../../config/database');
const logger = require('../../utils/logger');

async function addPriorityField() {
    try {
        logger.info('Running migration: add-priority-field');

        // Add priority column to contacts table
        await query(`
            ALTER TABLE contacts
            ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 0
        `);
        logger.info('✅ Added priority field to contacts table');

        // Update existing contacts to have priority 0
        await query(`
            UPDATE contacts
            SET priority = 0
            WHERE priority IS NULL
        `);
        logger.info('✅ Updated existing contacts with default priority');

        logger.info('✅ Migration completed: add-priority-field');
        return true;

    } catch (error) {
        logger.error('❌ Migration failed: add-priority-field', error);
        throw error;
    }
}

module.exports = addPriorityField;
