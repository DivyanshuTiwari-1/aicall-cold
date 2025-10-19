require('dotenv').config();
const { query } = require('../config/database');
const logger = require('../utils/logger');

async function createTables() {
    try {
        logger.info('🔄 Creating database tables...');

        // Organizations table
        await query(`
      CREATE TABLE IF NOT EXISTS organizations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        domain VARCHAR(255) UNIQUE,
        license_seats INTEGER DEFAULT 1,
        credits_balance DECIMAL(10,2) DEFAULT 0,
        credits_consumed DECIMAL(10,2) DEFAULT 0,
        settings JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

        // Users table
        await query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        role VARCHAR(50) DEFAULT 'user',
        role_type VARCHAR(50) DEFAULT 'agent' CHECK (role_type IN ('admin', 'manager', 'agent', 'data_uploader')),
        daily_call_target INTEGER DEFAULT 50,
        assigned_leads_count INTEGER DEFAULT 0,
        sip_extension VARCHAR(10) UNIQUE,
        sip_username VARCHAR(50),
        sip_password VARCHAR(100),
        is_available BOOLEAN DEFAULT true,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

        // Campaigns table
        await query(`
      CREATE TABLE IF NOT EXISTS campaigns (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL CHECK (type IN ('sales', 'marketing', 'follow_up', 'recruitment')),
        status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed')),
        voice_persona VARCHAR(100) DEFAULT 'professional',
        language VARCHAR(10) DEFAULT 'en-US',
        accent VARCHAR(20) DEFAULT 'professional',
        auto_retry BOOLEAN DEFAULT true,
        best_time_enabled BOOLEAN DEFAULT true,
        emotion_detection BOOLEAN DEFAULT true,
        script_id UUID,
        description TEXT,
        call_settings JSONB DEFAULT '{}',
        settings JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

        // Contacts table
        await query(`
      CREATE TABLE IF NOT EXISTS contacts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100),
        phone VARCHAR(20) NOT NULL,
        email VARCHAR(255),
        company VARCHAR(255),
        title VARCHAR(255),
        industry VARCHAR(100),
        location VARCHAR(255),
        custom_fields JSONB DEFAULT '{}',
        status VARCHAR(50) DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'interested', 'not_interested', 'do_not_call', 'retry_pending', 'exhausted')),
        retry_count INTEGER DEFAULT 0,
        max_retries INTEGER DEFAULT 3,
        next_retry_at TIMESTAMP,
        best_time_to_call TIME,
        last_contacted TIMESTAMP,
        reuse_count INTEGER DEFAULT 0,
        last_reuse_at TIMESTAMP,
        reuse_enabled BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

        // Calls table
        await query(`
      CREATE TABLE IF NOT EXISTS calls (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
        contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
        initiated_by UUID REFERENCES users(id),
        twilio_call_sid VARCHAR(255),
        call_type VARCHAR(20) DEFAULT 'automated' CHECK (call_type IN ('automated', 'manual')),
        status VARCHAR(50) DEFAULT 'initiated' CHECK (status IN ('initiated', 'ringing', 'in_progress', 'completed', 'failed', 'busy', 'no_answer')),
        outcome VARCHAR(50) CHECK (outcome IN ('scheduled', 'interested', 'not_interested', 'callback', 'voicemail', 'busy', 'no_answer', 'failed', 'answered', 'rejected', 'missed', 'wrong_number', 'dnc_request')),
        duration INTEGER DEFAULT 0,
        transcript TEXT,
        emotion VARCHAR(50),
        intent_score DECIMAL(3,2),
        csat_score DECIMAL(2,1),
        cost DECIMAL(10,4) DEFAULT 0,
        answered BOOLEAN DEFAULT false,
        rejected BOOLEAN DEFAULT false,
        notes TEXT,
        ai_insights JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

        // Call events table for state machine
        await query(`
      CREATE TABLE IF NOT EXISTS call_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        call_id UUID REFERENCES calls(id) ON DELETE CASCADE,
        event_type VARCHAR(100) NOT NULL,
        event_data JSONB DEFAULT '{}',
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

        // Scripts table
        await query(`
      CREATE TABLE IF NOT EXISTS scripts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL CHECK (type IN ('main_pitch', 'follow_up', 'objection_handling', 'closing')),
        content TEXT NOT NULL,
        variables JSONB DEFAULT '{}',
        is_active BOOLEAN DEFAULT true,
        category VARCHAR(100),
        confidence_threshold DECIMAL(3,2) DEFAULT 0.7,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

        // Voice personas table
        await query(`
      CREATE TABLE IF NOT EXISTS voice_personas (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        voice_id VARCHAR(100),
        language VARCHAR(10) DEFAULT 'en-US',
        settings JSONB DEFAULT '{}',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

        // Knowledge base table
        await query(`
      CREATE TABLE IF NOT EXISTS knowledge_base (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        question TEXT NOT NULL,
        answer TEXT NOT NULL,
        category VARCHAR(100),
        confidence DECIMAL(3,2) DEFAULT 1.0,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

        // DNC registry table
        await query(`
      CREATE TABLE IF NOT EXISTS dnc_registry (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        phone VARCHAR(20) NOT NULL,
        reason VARCHAR(255),
        source VARCHAR(100) DEFAULT 'manual',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(organization_id, phone)
      )
    `);

        // Audit logs table
        await query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        action VARCHAR(100) NOT NULL,
        resource_type VARCHAR(100) NOT NULL,
        resource_id UUID,
        details JSONB DEFAULT '{}',
        compliance_event BOOLEAN DEFAULT false,
        ip_address INET,
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

        // Lead assignments table
        await query(`
      CREATE TABLE IF NOT EXISTS lead_assignments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
        assigned_to UUID REFERENCES users(id) ON DELETE CASCADE,
        assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
        assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'expired')),
        expires_at TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(contact_id, assigned_to)
      )
    `);

        // Add updated_at column if it doesn't exist (for existing tables)
        await query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'lead_assignments'
                    AND column_name = 'updated_at'
                ) THEN
                    ALTER TABLE lead_assignments ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
                END IF;
            END $$;
        `);

        // Call analysis table
        await query(`
      CREATE TABLE IF NOT EXISTS call_analysis (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        call_id UUID REFERENCES calls(id) ON DELETE CASCADE,
        intent_label VARCHAR(100),
        intent_confidence DECIMAL(3,2),
        emotion_dominant VARCHAR(50),
        emotion_intensity DECIMAL(3,2),
        emotion_volatility DECIMAL(3,2),
        emotion_timeline JSONB DEFAULT '[]',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

        // Call tags table
        await query(`
      CREATE TABLE IF NOT EXISTS call_tags (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        call_id UUID REFERENCES calls(id) ON DELETE CASCADE,
        tag VARCHAR(100) NOT NULL,
        tag_type VARCHAR(20) CHECK (tag_type IN ('auto', 'manual')),
        added_by UUID REFERENCES users(id) ON DELETE SET NULL,
        confidence DECIMAL(3,2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

        // Call objections table
        await query(`
      CREATE TABLE IF NOT EXISTS call_objections (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        call_id UUID REFERENCES calls(id) ON DELETE CASCADE,
        objection_type VARCHAR(100),
        severity VARCHAR(20) CHECK (severity IN ('low', 'medium', 'high')),
        timestamp_seconds INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

        // Call highlights table
        await query(`
      CREATE TABLE IF NOT EXISTS call_highlights (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        call_id UUID REFERENCES calls(id) ON DELETE CASCADE,
        timestamp_seconds INTEGER,
        highlight_type VARCHAR(50),
        description TEXT,
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

        // Consent records table
        await query(`
      CREATE TABLE IF NOT EXISTS consent_records (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
        consent_type VARCHAR(50),
        consent_given BOOLEAN DEFAULT false,
        region VARCHAR(10),
        recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

        // Credit transactions table
        await query(`
      CREATE TABLE IF NOT EXISTS credit_transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        amount DECIMAL(10,2),
        type VARCHAR(50) CHECK (type IN ('purchase', 'consumption', 'refund')),
        description TEXT,
        call_id UUID REFERENCES calls(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

        // Emotion turns table for detailed per-turn tracking
        await query(`
      CREATE TABLE IF NOT EXISTS emotion_turns (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        call_id UUID REFERENCES calls(id) ON DELETE CASCADE,
        turn_number INTEGER NOT NULL,
        speaker VARCHAR(20) NOT NULL CHECK (speaker IN ('agent', 'customer')),
        emotion VARCHAR(50) NOT NULL,
        intensity DECIMAL(3,2) NOT NULL CHECK (intensity >= 0 AND intensity <= 1),
        confidence DECIMAL(3,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
        timestamp_seconds INTEGER NOT NULL,
        text_snippet TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

        // Agent empathy scores table
        await query(`
      CREATE TABLE IF NOT EXISTS agent_empathy_scores (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        agent_id UUID REFERENCES users(id) ON DELETE CASCADE,
        call_id UUID REFERENCES calls(id) ON DELETE CASCADE,
        initial_emotion VARCHAR(50) NOT NULL,
        final_emotion VARCHAR(50) NOT NULL,
        empathy_score DECIMAL(3,2) NOT NULL CHECK (empathy_score >= 0 AND empathy_score <= 1),
        emotion_improvement BOOLEAN NOT NULL,
        calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

        // Reuse settings table
        await query(`
      CREATE TABLE IF NOT EXISTS reuse_settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        auto_reuse_enabled BOOLEAN DEFAULT true,
        max_reuse_attempts INTEGER DEFAULT 3,
        reuse_delay_hours INTEGER DEFAULT 24,
        reuse_time_windows JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(organization_id)
      )
    `);

        // Reuse logs table
        await query(`
      CREATE TABLE IF NOT EXISTS reuse_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
        original_call_id UUID REFERENCES calls(id) ON DELETE CASCADE,
        reuse_reason VARCHAR(100) NOT NULL,
        reassigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
        reuse_attempt INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

        // Warm transfers table
        await query(`
      CREATE TABLE IF NOT EXISTS warm_transfers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        call_id UUID REFERENCES calls(id) ON DELETE CASCADE,
        from_agent_id UUID REFERENCES users(id) ON DELETE CASCADE,
        to_agent_id UUID REFERENCES users(id) ON DELETE CASCADE,
        transfer_reason VARCHAR(255),
        intent_label VARCHAR(100),
        intent_confidence DECIMAL(3,2),
        status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'completed')),
        requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        responded_at TIMESTAMP,
        completed_at TIMESTAMP
      )
    `);

        // Knowledge entries table (enhanced)
        await query(`
      CREATE TABLE IF NOT EXISTS knowledge_entries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        question TEXT NOT NULL,
        answer TEXT NOT NULL,
        category VARCHAR(100),
        confidence DECIMAL(3,2) DEFAULT 1.0,
        usage_count INTEGER DEFAULT 0,
        last_used_at TIMESTAMP,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

        // Knowledge queries table
        await query(`
      CREATE TABLE IF NOT EXISTS knowledge_queries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        call_id UUID REFERENCES calls(id) ON DELETE CASCADE,
        query_text TEXT NOT NULL,
        matched_entry_id UUID REFERENCES knowledge_entries(id) ON DELETE SET NULL,
        confidence_score DECIMAL(3,2),
        was_helpful BOOLEAN,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

        // Emotional alerts table
        await query(`
      CREATE TABLE IF NOT EXISTS emotional_alerts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        call_id UUID REFERENCES calls(id) ON DELETE CASCADE,
        alert_type VARCHAR(50) NOT NULL,
        emotion VARCHAR(50) NOT NULL,
        intensity DECIMAL(3,2) NOT NULL,
        duration_seconds INTEGER NOT NULL,
        supervisor_notified BOOLEAN DEFAULT false,
        resolved BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

        // Supervisor tasks table
        await query(`
      CREATE TABLE IF NOT EXISTS supervisor_tasks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        alert_id UUID REFERENCES emotional_alerts(id) ON DELETE CASCADE,
        call_id UUID REFERENCES calls(id) ON DELETE CASCADE,
        assigned_to UUID REFERENCES users(id) ON DELETE CASCADE,
        task_type VARCHAR(50) NOT NULL,
        priority VARCHAR(20) DEFAULT 'high' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
        status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP
      )
    `);

        // Webhook configs table
        await query(`
      CREATE TABLE IF NOT EXISTS webhook_configs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        event_type VARCHAR(100) NOT NULL,
        webhook_url TEXT NOT NULL,
        secret_key VARCHAR(255),
        is_active BOOLEAN DEFAULT true,
        retry_count INTEGER DEFAULT 3,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

        // Webhook logs table
        await query(`
      CREATE TABLE IF NOT EXISTS webhook_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        webhook_config_id UUID REFERENCES webhook_configs(id) ON DELETE CASCADE,
        event_type VARCHAR(100) NOT NULL,
        payload JSONB NOT NULL,
        status_code INTEGER,
        response_body TEXT,
        attempt_count INTEGER DEFAULT 1,
        delivered_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

        // Create indexes for better performance
        await query(`CREATE INDEX IF NOT EXISTS idx_calls_organization_id ON calls(organization_id)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_calls_campaign_id ON calls(campaign_id)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_calls_contact_id ON calls(contact_id)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_calls_status ON calls(status)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_calls_created_at ON calls(created_at)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_calls_call_type ON calls(call_type)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_calls_initiated_by ON calls(initiated_by)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_contacts_organization_id ON contacts(organization_id)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_contacts_campaign_id ON contacts(campaign_id)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(phone)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(status)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_contacts_next_retry_at ON contacts(next_retry_at)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_dnc_phone ON dnc_registry(phone)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_lead_assignments_organization_id ON lead_assignments(organization_id)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_lead_assignments_assigned_to ON lead_assignments(assigned_to)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_lead_assignments_status ON lead_assignments(status)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_call_analysis_call_id ON call_analysis(call_id)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_call_tags_call_id ON call_tags(call_id)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_call_objections_call_id ON call_objections(call_id)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_call_highlights_call_id ON call_highlights(call_id)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_credit_transactions_organization_id ON credit_transactions(organization_id)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_users_organization_id ON users(organization_id)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_users_role_type ON users(role_type)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_users_sip_extension ON users(sip_extension)`);

        // New indexes for Phase 1 enhancements
        await query(`CREATE INDEX IF NOT EXISTS idx_emotion_turns_call_id ON emotion_turns(call_id)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_emotion_turns_timestamp ON emotion_turns(timestamp_seconds)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_agent_empathy_scores_agent_id ON agent_empathy_scores(agent_id)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_agent_empathy_scores_call_id ON agent_empathy_scores(call_id)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_reuse_settings_organization_id ON reuse_settings(organization_id)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_reuse_logs_contact_id ON reuse_logs(contact_id)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_reuse_logs_reassigned_to ON reuse_logs(reassigned_to)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_warm_transfers_call_id ON warm_transfers(call_id)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_warm_transfers_to_agent_id ON warm_transfers(to_agent_id)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_warm_transfers_status ON warm_transfers(status)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_knowledge_entries_organization_id ON knowledge_entries(organization_id)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_knowledge_entries_category ON knowledge_entries(category)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_knowledge_queries_call_id ON knowledge_queries(call_id)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_emotional_alerts_call_id ON emotional_alerts(call_id)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_emotional_alerts_alert_type ON emotional_alerts(alert_type)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_supervisor_tasks_assigned_to ON supervisor_tasks(assigned_to)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_supervisor_tasks_status ON supervisor_tasks(status)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_webhook_configs_organization_id ON webhook_configs(organization_id)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_webhook_configs_event_type ON webhook_configs(event_type)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_webhook_logs_webhook_config_id ON webhook_logs(webhook_config_id)`);

        // Add reuse columns to contacts table if they don't exist
        try {
            await query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS reuse_count INTEGER DEFAULT 0`);
            await query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_reuse_at TIMESTAMP`);
            await query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS reuse_enabled BOOLEAN DEFAULT true`);
        } catch (error) {
            logger.warn('Could not add reuse columns to contacts table:', error.message);
        }

        // Create indexes for reuse columns
        try {
            await query(`CREATE INDEX IF NOT EXISTS idx_contacts_reuse_count ON contacts(reuse_count)`);
            await query(`CREATE INDEX IF NOT EXISTS idx_contacts_last_reuse_at ON contacts(last_reuse_at)`);
        } catch (error) {
            logger.warn('Could not create reuse indexes:', error.message);
        }

        logger.info('✅ Database tables created successfully');
    } catch (error) {
        logger.error('❌ Database migration failed:', error);
        throw error;
    }
}

// Seed sample data
async function seedData() {
    try {
        logger.info('🌱 Seeding sample data...');

        // Create sample organization
        const orgResult = await query(`
      INSERT INTO organizations (id, name, domain, settings)
      VALUES ('550e8400-e29b-41d4-a716-446655440000', 'Demo Company', 'demo.com', '{"timezone": "UTC", "features": ["emotion_detection", "voice_cloning"]}')
      ON CONFLICT (id) DO NOTHING
      RETURNING id
    `);

        // Create sample user
        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash('password123', 10);

        await query(`
      INSERT INTO users (id, organization_id, email, password_hash, first_name, last_name, role)
      VALUES ('550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440000', 'admin@demo.com', $1, 'Admin', 'User', 'admin')
      ON CONFLICT (email) DO NOTHING
    `, [hashedPassword]);

        // Create sample campaign
        await query(`
      INSERT INTO campaigns (id, organization_id, name, type, status, voice_persona, settings)
      VALUES ('550e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440000', 'Q4 Sales Outreach', 'sales', 'active', 'professional', '{"max_retries": 3, "retry_delay": 3600}')
      ON CONFLICT (id) DO NOTHING
    `);

        // Create sample knowledge base entries
        await query(`
      INSERT INTO knowledge_base (organization_id, question, answer, category) VALUES
      ('550e8400-e29b-41d4-a716-446655440000', 'What is your pricing?', 'Our pricing starts at $99/month for the basic plan', 'pricing'),
      ('550e8400-e29b-41d4-a716-446655440000', 'Do you offer a free trial?', 'Yes, we offer a 14-day free trial with full access to all features', 'trial'),
      ('550e8400-e29b-41d4-a716-446655440000', 'What integrations do you support?', 'We integrate with Salesforce, HubSpot, and over 50 other tools', 'integrations')
      ON CONFLICT DO NOTHING
    `);

        logger.info('✅ Sample data seeded successfully');
    } catch (error) {
        logger.error('❌ Data seeding failed:', error);
        throw error;
    }
}

module.exports = { createTables, seedData };
