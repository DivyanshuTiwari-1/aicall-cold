require('dotenv').config();
const { query } = require('../config/database');
const bcrypt = require('bcryptjs');

async function seedSampleData() {
    try {
        console.log('🌱 Seeding sample data...');

        // Create sample organization
        const orgResult = await query(`
            INSERT INTO organizations (id, name, domain, settings)
            VALUES ('550e8400-e29b-41d4-a716-446655440000', 'Demo Company', 'demo.com', '{"timezone": "UTC", "features": ["emotion_detection", "voice_cloning"]}')
            ON CONFLICT (id) DO NOTHING
            RETURNING id
        `);

        // Create sample user
        const hashedPassword = await bcrypt.hash('password123', 10);

        await query(`
            INSERT INTO users (id, organization_id, email, password_hash, first_name, last_name, role)
            VALUES ('550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440000', 'admin@demo.com', $1, 'Admin', 'User', 'admin')
            ON CONFLICT (email) DO NOTHING
        `, [hashedPassword]);

        // Create sample campaigns
        await query(`
            INSERT INTO campaigns (id, organization_id, name, type, status, voice_persona, settings)
            VALUES
            ('550e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440000', 'Q4 Sales Outreach', 'sales', 'active', 'professional', '{"max_retries": 3, "retry_delay": 3600}'),
            ('550e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440000', 'Tech Recruitment', 'recruitment', 'draft', 'friendly', '{"max_retries": 2, "retry_delay": 1800}')
            ON CONFLICT (id) DO NOTHING
        `);

        // Create sample contacts
        const sampleContacts = [{
                id: '550e8400-e29b-41d4-a716-446655440010',
                campaign_id: '550e8400-e29b-41d4-a716-446655440002',
                first_name: 'John',
                last_name: 'Smith',
                phone: '+12025550101',
                email: 'john.smith@example.com',
                company: 'Acme Corp',
                title: 'CEO'
            },
            {
                id: '550e8400-e29b-41d4-a716-446655440011',
                campaign_id: '550e8400-e29b-41d4-a716-446655440002',
                first_name: 'Sarah',
                last_name: 'Johnson',
                phone: '+12025550102',
                email: 'sarah.johnson@techcorp.com',
                company: 'TechCorp',
                title: 'CTO'
            },
            {
                id: '550e8400-e29b-41d4-a716-446655440012',
                campaign_id: '550e8400-e29b-41d4-a716-446655440002',
                first_name: 'Mike',
                last_name: 'Davis',
                phone: '+12025550103',
                email: 'mike.davis@startup.io',
                company: 'StartupIO',
                title: 'Founder'
            },
            {
                id: '550e8400-e29b-41d4-a716-446655440013',
                campaign_id: '550e8400-e29b-41d4-a716-446655440003',
                first_name: 'Emily',
                last_name: 'Chen',
                phone: '+12025550104',
                email: 'emily.chen@dev.com',
                company: 'DevCorp',
                title: 'Senior Developer'
            },
            {
                id: '550e8400-e29b-41d4-a716-446655440014',
                campaign_id: '550e8400-e29b-41d4-a716-446655440003',
                first_name: 'Alex',
                last_name: 'Rodriguez',
                phone: '+12025550105',
                email: 'alex.rodriguez@tech.com',
                company: 'TechStart',
                title: 'Product Manager'
            }
        ];

        for (const contact of sampleContacts) {
            await query(`
                INSERT INTO contacts (id, organization_id, campaign_id, first_name, last_name, phone, email, company, title, custom_fields)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                ON CONFLICT (id) DO NOTHING
            `, [
                contact.id,
                '550e8400-e29b-41d4-a716-446655440000',
                contact.campaign_id,
                contact.first_name,
                contact.last_name,
                contact.phone,
                contact.email,
                contact.company,
                contact.title,
                JSON.stringify({})
            ]);
        }

        // Create sample knowledge base entries
        await query(`
            INSERT INTO knowledge_base (organization_id, question, answer, category) VALUES
            ('550e8400-e29b-41d4-a716-446655440000', 'What is your pricing?', 'Our pricing starts at $99/month for the basic plan', 'pricing'),
            ('550e8400-e29b-41d4-a716-446655440000', 'Do you offer a free trial?', 'Yes, we offer a 14-day free trial with full access to all features', 'trial'),
            ('550e8400-e29b-41d4-a716-446655440000', 'What integrations do you support?', 'We integrate with Salesforce, HubSpot, and over 50 other tools', 'integrations'),
            ('550e8400-e29b-41d4-a716-446655440000', 'How does the AI work?', 'Our AI uses advanced natural language processing to understand context and respond naturally', 'technology'),
            ('550e8400-e29b-41d4-a716-446655440000', 'What is your uptime guarantee?', 'We guarantee 99.9% uptime with 24/7 monitoring', 'reliability')
            ON CONFLICT DO NOTHING
        `);

        console.log('✅ Sample data seeded successfully');
        console.log('📧 Login credentials: admin@demo.com / password123');
        console.log('📞 Sample contacts created for testing calls');

    } catch (error) {
        console.error('❌ Data seeding failed:', error);
        throw error;
    }
}

// Run if called directly
if (require.main === module) {
    seedSampleData()
        .then(() => {
            console.log('✅ Seeding completed');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Seeding failed:', error);
            process.exit(1);
        });
}

module.exports = { seedSampleData };