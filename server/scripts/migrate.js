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
        type VARCHAR(50) NOT NULL CHECK (type IN ('sales', 'recruitment')),
        status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed')),
        voice_persona VARCHAR(100) DEFAULT 'professional',
        auto_retry BOOLEAN DEFAULT true,
        best_time_enabled BOOLEAN DEFAULT true,
        emotion_detection BOOLEAN DEFAULT true,
        script_id UUID,
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
        status VARCHAR(50) DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'interested', 'not_interested', 'do_not_call')),
        last_contacted TIMESTAMP,
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
        twilio_call_sid VARCHAR(255),
        status VARCHAR(50) DEFAULT 'initiated' CHECK (status IN ('initiated', 'ringing', 'in_progress', 'completed', 'failed', 'busy', 'no_answer')),
        outcome VARCHAR(50) CHECK (outcome IN ('scheduled', 'interested', 'not_interested', 'callback', 'voicemail', 'busy', 'no_answer', 'failed')),
        duration INTEGER DEFAULT 0,
        transcript TEXT,
        emotion VARCHAR(50),
        intent_score DECIMAL(3,2),
        csat_score DECIMAL(2,1),
        cost DECIMAL(10,4) DEFAULT 0,
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
        type VARCHAR(50) NOT NULL,
        content TEXT NOT NULL,
        variables JSONB DEFAULT '{}',
        is_active BOOLEAN DEFAULT true,
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
        ip_address INET,
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

        // Create indexes for better performance
        await query(`CREATE INDEX IF NOT EXISTS idx_calls_organization_id ON calls(organization_id)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_calls_campaign_id ON calls(campaign_id)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_calls_contact_id ON calls(contact_id)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_calls_status ON calls(status)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_calls_created_at ON calls(created_at)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_contacts_organization_id ON contacts(organization_id)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_contacts_campaign_id ON contacts(campaign_id)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(phone)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_dnc_phone ON dnc_registry(phone)`);

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