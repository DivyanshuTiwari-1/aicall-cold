const { query } = require('../../config/database');
const logger = require('../../utils/logger');

async function addSipFields() {
    try {
        logger.info('Starting SIP fields migration...');

        // Check if SIP fields already exist
        const checkColumns = await query(`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'users'
            AND column_name IN ('sip_extension', 'sip_username', 'sip_password')
        `);

        const existingColumns = checkColumns.rows.map(row => row.column_name);
        const requiredColumns = ['sip_extension', 'sip_username', 'sip_password'];
        const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));

        if (missingColumns.length === 0) {
            logger.info('✅ SIP fields already exist in users table');
            return;
        }

        // Add missing SIP fields
        for (const column of missingColumns) {
            let columnDefinition = '';

            switch (column) {
                case 'sip_extension':
                    columnDefinition = 'sip_extension VARCHAR(10)';
                    break;
                case 'sip_username':
                    columnDefinition = 'sip_username VARCHAR(50)';
                    break;
                case 'sip_password':
                    columnDefinition = 'sip_password VARCHAR(100)';
                    break;
            }

            if (columnDefinition) {
                await query(`ALTER TABLE users ADD COLUMN ${columnDefinition}`);
                logger.info(`✅ Added column: ${column}`);
            }
        }

        // Add indexes for better performance
        try {
            await query('CREATE INDEX IF NOT EXISTS idx_users_sip_extension ON users(sip_extension)');
            await query('CREATE INDEX IF NOT EXISTS idx_users_sip_username ON users(sip_username)');
            logger.info('✅ Added SIP-related indexes');
        } catch (indexError) {
            logger.warn('Index creation failed (may already exist):', indexError.message);
        }

        logger.info('✅ SIP fields migration completed successfully');

    } catch (error) {
        logger.error('❌ SIP fields migration failed:', error);
        throw error;
    }
}

// Run migration if called directly
if (require.main === module) {
    addSipFields()
        .then(() => {
            logger.info('Migration completed');
            process.exit(0);
        })
        .catch((error) => {
            logger.error('Migration failed:', error);
            process.exit(1);
        });
}

module.exports = addSipFields;

