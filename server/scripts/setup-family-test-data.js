#!/usr/bin/env node

/**
 * Setup Family Test Data for Automated Calls
 * Creates test data with 5 family phone numbers for testing automated calls
 */

const { query } = require('../config/database');
const logger = require('../utils/logger');

class FamilyTestDataSetup {
    constructor() {
        this.testData = {
            organization: null,
            user: null,
            campaign: null,
            contacts: []
        };
    }

    async setupTestData() {
        try {
            console.log('🚀 Setting up Family Test Data for Automated Calls...\n');

            // Step 1: Create test organization
            console.log('1️⃣ Creating test organization...');
            await this.createTestOrganization();

            // Step 2: Create test user (agent)
            console.log('2️⃣ Creating test user...');
            await this.createTestUser();

            // Step 3: Create test campaign
            console.log('3️⃣ Creating test campaign...');
            await this.createTestCampaign();

            // Step 4: Create 5 family contacts
            console.log('4️⃣ Creating 5 family contacts...');
            await this.createFamilyContacts();

            // Step 5: Display test data
            console.log('5️⃣ Test data created successfully!');
            this.displayTestData();

            console.log('\n✅ Family test data setup completed!');
            console.log('🎉 You can now test automated calls with these 5 family numbers!');

        } catch (error) {
            console.error('\n❌ Family test data setup failed:', error.message);
            await this.cleanup();
            process.exit(1);
        }
    }

    async createTestOrganization() {
        const orgResult = await query(`
            INSERT INTO organizations (name, domain, license_seats, credits_balance)
            VALUES ('Family Test Org', 'familytest.com', 10, 5000)
            RETURNING *
        `);
        this.testData.organization = orgResult.rows[0];
        console.log('   ✅ Organization created:', this.testData.organization.name);
    }

    async createTestUser() {
        const randomExtension = Math.floor(Math.random() * 9000) + 1000; // Random 4-digit number
        const userResult = await query(`
            INSERT INTO users (organization_id, email, first_name, last_name, role_type, password_hash, is_available, sip_extension)
            VALUES ($1, 'agent@familytest.com', 'Test', 'Agent', 'agent', 'hashed_password', true, $2)
            RETURNING *
        `, [this.testData.organization.id, randomExtension.toString()]);
        this.testData.user = userResult.rows[0];
        console.log('   ✅ User created:', this.testData.user.email);
    }

    async createTestCampaign() {
        const campaignResult = await query(`
            INSERT INTO campaigns (organization_id, name, type, status)
            VALUES ($1, 'Family Test Campaign', 'sales', 'active')
            RETURNING *
        `, [this.testData.organization.id]);
        this.testData.campaign = campaignResult.rows[0];
        console.log('   ✅ Campaign created:', this.testData.campaign.name);
    }

    async createFamilyContacts() {
        const familyNumbers = [
            { firstName: 'John', lastName: 'Smith', phone: '+1234567890', email: 'john@family.com' },
            { firstName: 'Jane', lastName: 'Smith', phone: '+1234567891', email: 'jane@family.com' },
            { firstName: 'Bob', lastName: 'Smith', phone: '+1234567892', email: 'bob@family.com' },
            { firstName: 'Alice', lastName: 'Smith', phone: '+1234567893', email: 'alice@family.com' },
            { firstName: 'Charlie', lastName: 'Smith', phone: '+1234567894', email: 'charlie@family.com' }
        ];

        for (const contactData of familyNumbers) {
            const contactResult = await query(`
                INSERT INTO contacts (organization_id, campaign_id, first_name, last_name, phone, email, company, status)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING *
            `, [
                this.testData.organization.id,
                this.testData.campaign.id,
                contactData.firstName,
                contactData.lastName,
                contactData.phone,
                contactData.email,
                'Family Test Company',
                'new'
            ]);
            this.testData.contacts.push(contactResult.rows[0]);
        }
        console.log('   ✅ Created 5 family contacts');
    }

    displayTestData() {
        console.log('\n📋 Test Data Summary:');
        console.log('===================');
        console.log(`Organization: ${this.testData.organization.name} (ID: ${this.testData.organization.id})`);
        console.log(`User: ${this.testData.user.email} (ID: ${this.testData.user.id})`);
        console.log(`Campaign: ${this.testData.campaign.name} (ID: ${this.testData.campaign.id})`);
        console.log('\n👨‍👩‍👧‍👦 Family Contacts:');
        this.testData.contacts.forEach((contact, index) => {
            console.log(`   ${index + 1}. ${contact.first_name} ${contact.last_name} - ${contact.phone}`);
        });

        console.log('\n🎯 Next Steps:');
        console.log('1. Go to the web interface');
        console.log('2. Navigate to "Campaigns" page');
        console.log('3. Find "Family Test Campaign"');
        console.log('4. Click "Start Queue" button');
        console.log('5. Watch automated calls begin!');
    }

    async cleanup() {
        try {
            if (this.testData.organization) {
                await query(`DELETE FROM organizations WHERE id = $1`, [this.testData.organization.id]);
                console.log('   ✅ Test data cleaned up');
            }
        } catch (error) {
            console.log('   ⚠️  Cleanup had issues:', error.message);
        }
    }
}

// Run the setup
if (require.main === module) {
    const setup = new FamilyTestDataSetup();
    setup.setupTestData()
        .then(() => {
            console.log('\n🎉 Family test data setup completed!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n💥 Family test data setup failed:', error);
            process.exit(1);
        });
}

module.exports = FamilyTestDataSetup;
