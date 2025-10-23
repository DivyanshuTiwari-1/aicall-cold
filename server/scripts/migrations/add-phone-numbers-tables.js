const { query } = require('../../config/database');
const logger = require('../../utils/logger');

async function addPhoneNumbersTables() {
    try {
        logger.info('Adding phone numbers and agent assignment tables...');

        // Create phone_numbers table
        await query(`
            CREATE TABLE IF NOT EXISTS phone_numbers (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
                phone_number VARCHAR(20) NOT NULL UNIQUE,
                provider VARCHAR(50) NOT NULL DEFAULT 'telnyx',
                country_code VARCHAR(2) NOT NULL,
                capabilities JSONB DEFAULT '{"voice": true, "sms": false}'::jsonb,
                status VARCHAR(20) NOT NULL DEFAULT 'active',
                assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        logger.info('✅ phone_numbers table created');

        // Create agent_phone_numbers table for assignments with limits
        await query(`
            CREATE TABLE IF NOT EXISTS agent_phone_numbers (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                agent_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                phone_number_id UUID NOT NULL REFERENCES phone_numbers(id) ON DELETE CASCADE,
                organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
                daily_limit INTEGER NOT NULL DEFAULT 100,
                allowed_countries JSONB NOT NULL DEFAULT '["US", "CA"]'::jsonb,
                calls_made_today INTEGER NOT NULL DEFAULT 0,
                last_reset_date DATE DEFAULT CURRENT_DATE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(agent_id, phone_number_id)
            );
        `);

        logger.info('✅ agent_phone_numbers table created');

        // Create indexes for better performance
        await query(`
            CREATE INDEX IF NOT EXISTS idx_phone_numbers_org
            ON phone_numbers(organization_id);
        `);

        await query(`
            CREATE INDEX IF NOT EXISTS idx_phone_numbers_assigned
            ON phone_numbers(assigned_to);
        `);

        await query(`
            CREATE INDEX IF NOT EXISTS idx_agent_phone_numbers_agent
            ON agent_phone_numbers(agent_id);
        `);

        await query(`
            CREATE INDEX IF NOT EXISTS idx_agent_phone_numbers_phone
            ON agent_phone_numbers(phone_number_id);
        `);

        logger.info('✅ Indexes created');

        // Create function to reset daily call counts
        await query(`
            CREATE OR REPLACE FUNCTION reset_daily_call_counts()
            RETURNS void AS $$
            BEGIN
                UPDATE agent_phone_numbers
                SET calls_made_today = 0,
                    last_reset_date = CURRENT_DATE
                WHERE last_reset_date < CURRENT_DATE;
            END;
            $$ LANGUAGE plpgsql;
        `);

        logger.info('✅ reset_daily_call_counts function created');

        logger.info('✅ Phone numbers tables migration completed successfully');
        return true;

    } catch (error) {
        logger.error('❌ Phone numbers tables migration failed:', error);
        throw error;
    }
}

module.exports = addPhoneNumbersTables;

// Run migration if called directly
if (require.main === module) {
    addPhoneNumbersTables()
        .then(() => {
            logger.info('Migration completed');
            process.exit(0);
        })
        .catch((error) => {
            logger.error('Migration failed:', error);
            process.exit(1);
        });
}
