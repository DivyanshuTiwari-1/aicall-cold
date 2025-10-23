#!/usr/bin/env node

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { query } = require('../config/database');
const { connectDB } = require('../config/database');

async function getSipCredentials() {
    try {
        await connectDB();

        console.log('');
        console.log('═══════════════════════════════════════════════════');
        console.log('       🎧 SIP SOFTPHONE CREDENTIALS');
        console.log('═══════════════════════════════════════════════════');
        console.log('');

        // Get all users with SIP extensions
        const result = await query(`
            SELECT
                id,
                email,
                first_name,
                last_name,
                sip_extension,
                sip_username,
                sip_password,
                role
            FROM users
            WHERE sip_extension IS NOT NULL
            ORDER BY created_at DESC
        `);

        if (result.rows.length === 0) {
            console.log('❌ No users found with SIP extensions.');
            console.log('');
            console.log('💡 Need to configure SIP? Run:');
            console.log('   node server/scripts/setup-agent-sip.js');
            console.log('');
            process.exit(1);
        }

        result.rows.forEach((user, index) => {
            console.log(`👤 User #${index + 1}: ${user.first_name} ${user.last_name}`);
            console.log(`   Email: ${user.email}`);
            console.log(`   Role: ${user.role}`);
            console.log('');
            console.log('   📞 SIP Configuration:');
            console.log(`   ┌─────────────────────────────────────────────`);
            console.log(`   │ Extension:    ${user.sip_extension}`);
            console.log(`   │ Username:     ${user.sip_username}`);
            console.log(`   │ Password:     ${user.sip_password}`);
            console.log(`   │ Server:       localhost:5060`);
            console.log(`   │ Domain:       localhost`);
            console.log(`   │ Protocol:     UDP`);
            console.log(`   └─────────────────────────────────────────────`);
            console.log('');
            console.log('   🔧 Quick Setup for MicroSIP:');
            console.log('   1. Download: https://www.microsip.org/downloads');
            console.log('   2. Account → Add Account');
            console.log(`   3. Username: ${user.sip_username}`);
            console.log(`   4. Password: ${user.sip_password}`);
            console.log('   5. Server: localhost:5060');
            console.log('   6. Save and wait for green status');
            console.log('');
            console.log('───────────────────────────────────────────────');
            console.log('');
        });

        console.log('');
        console.log('📖 Full setup guide: See SOFTPHONE_SETUP_GUIDE.md');
        console.log('');
        console.log('✅ After configuring your softphone:');
        console.log('   1. Wait for "Registered" status (green icon)');
        console.log('   2. Run: node server/test-asterisk-connection.js');
        console.log('   3. Look for your endpoint showing as "online"');
        console.log('   4. Try manual call in the app!');
        console.log('');

        process.exit(0);

    } catch (error) {
        console.error('❌ Error fetching SIP credentials:', error.message);
        process.exit(1);
    }
}

getSipCredentials();
