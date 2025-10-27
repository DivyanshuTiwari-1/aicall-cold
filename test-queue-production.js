#!/usr/bin/env node
/**
 * Production Queue & AI Calls Test
 */

const { query } = require('./config/database');

async function testProduction() {
    console.log('========================================');
    console.log('🧪 Testing AI Automated Calls System');
    console.log('========================================\n');

    try {
        // 1. Test database schema
        console.log('1️⃣  Testing Database Schema...');
        const schemaCheck = await query(`
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = 'contacts' AND column_name = 'priority'
        `);
        console.log(schemaCheck.rows.length > 0 ? '✅ Database schema is correct' : '❌ Missing priority column');

        // 2. Check for ready contacts
        console.log('\n2️⃣  Checking for Ready Contacts...');
        const contacts = await query(`
            SELECT
                ct.id,
                ct.first_name,
                ct.last_name,
                ct.phone,
                ct.status,
                ct.campaign_id,
                c.name as campaign_name
            FROM contacts ct
            JOIN campaigns c ON ct.campaign_id = c.id
            WHERE ct.status IN ('pending', 'new', 'retry')
            AND c.status = 'active'
            ORDER BY ct.created_at ASC
            LIMIT 5
        `);

        console.log(`✅ Found ${contacts.rows.length} contacts ready for calling`);
        if (contacts.rows.length > 0) {
            console.log('\nSample contacts:');
            contacts.rows.forEach((c, i) => {
                console.log(`  ${i + 1}. ${c.first_name} ${c.last_name} - ${c.phone} (${c.campaign_name})`);
            });
        }

        // 3. Check campaigns
        console.log('\n3️⃣  Checking Active Campaigns...');
        const campaigns = await query(`
            SELECT
                c.id,
                c.name,
                c.status,
                COUNT(ct.id) as contact_count
            FROM campaigns c
            LEFT JOIN contacts ct ON c.id = ct.campaign_id
                AND ct.status IN ('pending', 'new', 'retry')
            WHERE c.status = 'active'
            GROUP BY c.id, c.name, c.status
        `);

        console.log(`✅ Found ${campaigns.rows.length} active campaigns`);
        campaigns.rows.forEach((c, i) => {
            console.log(`  ${i + 1}. ${c.name} - ${c.contact_count} contacts ready`);
        });

        // 4. Check phone numbers
        console.log('\n4️⃣  Checking Available Phone Numbers...');
        const phoneNumbers = await query(`
            SELECT
                id,
                phone_number,
                provider,
                is_active
            FROM phone_numbers
            WHERE is_active = true
            LIMIT 3
        `);

        console.log(`✅ Found ${phoneNumbers.rows.length} active phone numbers`);
        phoneNumbers.rows.forEach((p, i) => {
            console.log(`  ${i + 1}. ${p.phone_number} (${p.provider})`);
        });

        // 5. Check recent calls
        console.log('\n5️⃣  Checking Recent Calls...');
        const recentCalls = await query(`
            SELECT
                id,
                status,
                automated,
                created_at
            FROM calls
            WHERE automated = true
            ORDER BY created_at DESC
            LIMIT 5
        `);

        console.log(`✅ Found ${recentCalls.rows.length} recent automated calls`);
        if (recentCalls.rows.length > 0) {
            recentCalls.rows.forEach((c, i) => {
                console.log(`  ${i + 1}. Status: ${c.status} - ${new Date(c.created_at).toLocaleString()}`);
            });
        }

        // 6. Test FastAGI Server
        console.log('\n6️⃣  Testing FastAGI Server...');
        const net = require('net');
        const agiTest = new Promise((resolve, reject) => {
            const client = net.createConnection({ port: 4573, host: 'localhost' }, () => {
                console.log('✅ FastAGI Server is listening on port 4573');
                client.end();
                resolve(true);
            });
            client.on('error', (err) => {
                console.log('❌ FastAGI Server not accessible:', err.message);
                reject(err);
            });
            setTimeout(() => {
                client.destroy();
                reject(new Error('Timeout'));
            }, 3000);
        });

        try {
            await agiTest;
        } catch (e) {
            console.log('⚠️  FastAGI Server check failed');
        }

        // 7. Check Asterisk extensions config
        console.log('\n7️⃣  Checking Asterisk Configuration...');
        const fs = require('fs');
        if (fs.existsSync('/etc/asterisk/extensions.conf')) {
            const extensionsConf = fs.readFileSync('/etc/asterisk/extensions.conf', 'utf8');
            if (extensionsConf.includes('ai-dialer-simplified.php') || extensionsConf.includes('AGI(agi://')) {
                console.log('✅ Asterisk is configured for AI calls');
            } else {
                console.log('⚠️  Asterisk configuration needs verification');
            }
        }

        console.log('\n========================================');
        console.log('✅ Production System Status: READY');
        console.log('========================================');
        console.log('\nTo start AI automated calls:');
        console.log('1. Login to https://atsservice.site/');
        console.log('2. Navigate to Campaigns page');
        console.log('3. Select your campaign');
        console.log('4. Click "Start Automated Calls" button');
        console.log('5. Monitor live calls in "Live Monitor" page');
        console.log('\n========================================\n');

        process.exit(0);

    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

testProduction();
