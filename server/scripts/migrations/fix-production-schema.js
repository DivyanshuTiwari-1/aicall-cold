#!/usr/bin/env node
/**
 * Production Schema Fix Migration
 * Adds missing columns to make automated calls work
 */

const { query } = require('../../config/database');
const logger = require('../../utils/logger');

async function fixProductionSchema() {
    try {
        logger.info('🔧 Starting production schema fix...');

        // 1. Add priority column to contacts table
        logger.info('Adding priority column to contacts...');
        await query(`
            ALTER TABLE contacts
            ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 0;
        `);
        logger.info('✅ Priority column added');

        // 2. Fix dnc_registry table
        logger.info('Fixing dnc_registry table...');
        await query(`
            ALTER TABLE dnc_registry
            ADD COLUMN IF NOT EXISTS added_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            ADD COLUMN IF NOT EXISTS added_by UUID REFERENCES users(id) ON DELETE SET NULL;
        `);
        // Update existing records
        await query(`
            UPDATE dnc_registry
            SET added_date = created_at
            WHERE added_date IS NULL;
        `);
        logger.info('✅ DNC registry fixed');

        // 3. Add consent_granted to calls table
        logger.info('Adding consent fields to calls...');
        await query(`
            ALTER TABLE calls
            ADD COLUMN IF NOT EXISTS consent_granted BOOLEAN DEFAULT false,
            ADD COLUMN IF NOT EXISTS consent_timestamp TIMESTAMP,
            ADD COLUMN IF NOT EXISTS consent_method VARCHAR(50);
        `);
        logger.info('✅ Consent fields added');

        // 4. Enable UUID extension first
        logger.info('Enabling UUID extension...');
        await query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
        logger.info('✅ UUID extension enabled');

        // 5. Create compliance_audit_logs table
        logger.info('Creating compliance_audit_logs table...');
        await query(`
            CREATE TABLE IF NOT EXISTS compliance_audit_logs (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
                user_id UUID REFERENCES users(id) ON DELETE SET NULL,
                action_type VARCHAR(100) NOT NULL,
                resource_type VARCHAR(100) NOT NULL,
                resource_id UUID,
                details JSONB,
                ip_address VARCHAR(50),
                user_agent TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await query(`
            CREATE INDEX IF NOT EXISTS idx_audit_logs_org_date
            ON compliance_audit_logs(organization_id, created_at DESC);
        `);

        await query(`
            CREATE INDEX IF NOT EXISTS idx_audit_logs_action
            ON compliance_audit_logs(action_type, created_at DESC);
        `);
        logger.info('✅ Compliance audit logs table created');

        // 6. Add indexes for better performance
        logger.info('Adding performance indexes...');
        await query(`
            CREATE INDEX IF NOT EXISTS idx_contacts_priority
            ON contacts(priority DESC, created_at ASC);
        `);

        await query(`
            CREATE INDEX IF NOT EXISTS idx_contacts_campaign_status
            ON contacts(campaign_id, status, last_contacted);
        `);
        logger.info('✅ Performance indexes added');

        // 7. Verify all columns exist
        logger.info('Verifying schema...');
        const verification = await query(`
            SELECT
                table_name,
                column_name,
                data_type
            FROM information_schema.columns
            WHERE table_name IN ('contacts', 'dnc_registry', 'calls', 'compliance_audit_logs')
            AND column_name IN ('priority', 'added_date', 'consent_granted')
            ORDER BY table_name, column_name;
        `);

        logger.info('Schema verification:', verification.rows);

        logger.info('✅ ✅ ✅ Production schema fix completed successfully!');
        return true;

    } catch (error) {
        logger.error('❌ Schema fix failed:', error);
        throw error;
    }
}

// Run migration if executed directly
if (require.main === module) {
    fixProductionSchema()
        .then(() => {
            console.log('\n✅ Migration completed successfully!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Migration failed:', error);
            process.exit(1);
        });
}

module.exports = { fixProductionSchema };
