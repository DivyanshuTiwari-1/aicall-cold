const { query } = require('../../config/database');
const logger = require('../../utils/logger');

async function addTranscriptField() {
    try {
        logger.info('Adding transcript field to calls table...');

        // Check if transcript column exists
        const checkColumn = await query(`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name='calls' AND column_name='transcript'
        `);

        if (checkColumn.rows.length === 0) {
            // Add transcript column
            await query(`
                ALTER TABLE calls
                ADD COLUMN transcript TEXT DEFAULT ''
            `);
            logger.info('✅ Added transcript column to calls table');
        } else {
            logger.info('✅ Transcript column already exists');
        }

        // Check if from_number and to_number columns exist
        const checkFromNumber = await query(`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name='calls' AND column_name='from_number'
        `);

        if (checkFromNumber.rows.length === 0) {
            await query(`
                ALTER TABLE calls
                ADD COLUMN from_number VARCHAR(20),
                ADD COLUMN to_number VARCHAR(20)
            `);
            logger.info('✅ Added from_number and to_number columns to calls table');
        } else {
            logger.info('✅ Phone number columns already exist');
        }

        return true;
    } catch (error) {
        logger.error('Error adding transcript field:', error);
        throw error;
    }
}

module.exports = addTranscriptField;

// Run if called directly
if (require.main === module) {
    const { connectDB } = require('../../config/database');
    connectDB()
        .then(() => addTranscriptField())
        .then(() => {
            logger.info('Migration completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            logger.error('Migration failed:', error);
            process.exit(1);
        });
}
