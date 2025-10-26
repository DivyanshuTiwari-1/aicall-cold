const { query } = require('../../config/database');
const logger = require('../../utils/logger');

/**
 * Migration: Add from_number and to_number fields to calls table
 * These fields are needed for automated calling queue
 */
async function addPhoneNumberFields() {
    try {
        logger.info('Running migration: add-phone-number-fields');

        // Add from_number column
        await query(`
            ALTER TABLE calls
            ADD COLUMN IF NOT EXISTS from_number VARCHAR(20)
        `);
        logger.info('Added from_number column to calls table');

        // Add to_number column
        await query(`
            ALTER TABLE calls
            ADD COLUMN IF NOT EXISTS to_number VARCHAR(20)
        `);
        logger.info('Added to_number column to calls table');

        // Create index for performance
        await query(`
            CREATE INDEX IF NOT EXISTS idx_calls_from_number ON calls(from_number)
        `);

        await query(`
            CREATE INDEX IF NOT EXISTS idx_calls_to_number ON calls(to_number)
        `);

        logger.info('✅ Migration completed: add-phone-number-fields');
        return true;
    } catch (error) {
        logger.error('❌ Migration failed: add-phone-number-fields', error);
        throw error;
    }
}

module.exports = addPhoneNumberFields;

// Run if called directly
if (require.main === module) {
    (async() => {
        try {
            await addPhoneNumberFields();
            process.exit(0);
        } catch (error) {
            console.error(error);
            process.exit(1);
        }
    })();
}
