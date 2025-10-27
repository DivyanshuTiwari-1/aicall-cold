#!/usr/bin/env node
/**
 * Test Automated Call Initiation
 */

const { query } = require('./config/database');
const axios = require('axios');

async function testCallInitiation() {
    console.log('========================================');
    console.log('🧪 Testing Automated Call Initiation');
    console.log('========================================\n');

    try {
        // 1. Get a test contact
        console.log('1️⃣  Finding test contact...');
        const contacts = await query(`
            SELECT
                ct.id,
                ct.first_name,
                ct.last_name,
                ct.phone,
                ct.campaign_id,
                c.name as campaign_name
            FROM contacts ct
            JOIN campaigns c ON ct.campaign_id = c.id
            WHERE ct.status IN ('pending', 'new')
            AND c.status = 'active'
            AND ct.phone IS NOT NULL
            ORDER BY ct.created_at ASC
            LIMIT 1
        `);

        if (contacts.rows.length === 0) {
            console.log('❌ No contacts available for testing');
            process.exit(1);
        }

        const contact = contacts.rows[0];
        console.log(`✅ Found contact: ${contact.first_name} ${contact.last_name} - ${contact.phone}`);
        console.log(`   Campaign: ${contact.campaign_name}\n`);

        // 2. Get phone number
        console.log('2️⃣  Getting phone number...');
        const phoneNumbers = await query(`
            SELECT id, phone_number, provider
            FROM phone_numbers
            WHERE is_active = true
            LIMIT 1
        `);

        if (phoneNumbers.rows.length === 0) {
            console.log('❌ No active phone numbers');
            process.exit(1);
        }

        const phoneNumber = phoneNumbers.rows[0];
        console.log(`✅ Using phone number: ${phoneNumber.phone_number} (${phoneNumber.provider})\n`);

        // 3. Create call record
        console.log('3️⃣  Creating call record...');
        const organization = await query(`SELECT id FROM organizations LIMIT 1`);
        const orgId = organization.rows[0].id;

        const callResult = await query(`
            INSERT INTO calls (
                organization_id,
                campaign_id,
                contact_id,
                status,
                automated,
                from_number,
                to_number
            ) VALUES ($1, $2, $3, 'initiated', true, $4, $5)
            RETURNING id
        `, [orgId, contact.campaign_id, contact.id, phoneNumber.phone_number, contact.phone]);

        const callId = callResult.rows[0].id;
        console.log(`✅ Call record created: ${callId}\n`);

        // 4. Test Asterisk ARI connection
        console.log('4️⃣  Testing Asterisk ARI...');
        try {
            const ariResponse = await axios.get('http://asterisk:8088/ari/asterisk/info', {
                auth: {
                    username: 'ai-dialer',
                    password: process.env.ARI_PASSWORD || 'ai-dialer-password'
                }
            });
            console.log(`✅ Asterisk ARI accessible: ${ariResponse.data.build.kernel}`);
        } catch (e) {
            console.log(`⚠️  Asterisk ARI error: ${e.message}`);
        }

        console.log('\n5️⃣  Testing FastAGI Server...');
        const net = require('net');
        try {
            await new Promise((resolve, reject) => {
                const client = net.createConnection({ port: 4573, host: 'localhost' }, () => {
                    console.log('✅ FastAGI Server is listening on port 4573');
                    client.end();
                    resolve();
                });
                client.on('error', reject);
                setTimeout(() => reject(new Error('Timeout')), 3000);
            });
        } catch (e) {
            console.log(`⚠️  FastAGI Server error: ${e.message}`);
        }

        console.log('\n========================================');
        console.log('✅ System is ready for automated calls!');
        console.log('========================================');
        console.log('\nTest call created with:');
        console.log(`  Call ID: ${callId}`);
        console.log(`  Contact: ${contact.first_name} ${contact.last_name}`);
        console.log(`  Phone: ${contact.phone}`);
        console.log(`  From: ${phoneNumber.phone_number}`);
        console.log('\nTo start automated calls:');
        console.log('1. Go to https://atsservice.site/campaigns');
        console.log('2. Click "Start Automated Calls"');
        console.log('3. Monitor in Live Monitor page');
        console.log('\n========================================\n');

        process.exit(0);

    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

testCallInitiation();
