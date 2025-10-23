#!/usr/bin/env node

require('dotenv').config();
const AriClient = require('ari-client');

const ARI_URL = process.env.ARI_URL || 'http://localhost:8088/ari';
const ARI_USER = process.env.ARI_USERNAME || process.env.ARI_USER || 'ai-dialer';
const ARI_PASS = process.env.ARI_PASSWORD || process.env.ARI_PASS || 'ai-dialer-password';

console.log('🔍 Testing Asterisk/ARI Connection...');
console.log(`URL: ${ARI_URL}`);
console.log(`User: ${ARI_USER}`);
console.log('');

async function testConnection() {
    try {
        console.log('⏳ Attempting to connect to ARI...');
        const ari = await AriClient.connect(ARI_URL, ARI_USER, ARI_PASS);
        console.log('✅ Successfully connected to Asterisk ARI!');
        console.log('');

        // List endpoints
        try {
            const endpoints = await ari.endpoints.list();
            console.log(`📞 Found ${endpoints.length} SIP endpoints:`);
            endpoints.forEach(ep => {
                console.log(`  - ${ep.resource} (${ep.state})`);
            });
            console.log('');
        } catch (e) {
            console.log('⚠️  Could not list endpoints:', e.message);
        }

        // List channels
        try {
            const channels = await ari.channels.list();
            console.log(`📡 Active channels: ${channels.length}`);
            console.log('');
        } catch (e) {
            console.log('⚠️  Could not list channels:', e.message);
        }

        console.log('✅ All Asterisk tests passed!');
        process.exit(0);

    } catch (error) {
        console.error('❌ Failed to connect to Asterisk ARI:');
        console.error('Error:', error.message);
        console.error('');
        console.error('💡 Troubleshooting steps:');
        console.error('1. Check if Asterisk is running: sudo systemctl status asterisk');
        console.error('2. Verify ARI is enabled in /etc/asterisk/http.conf');
        console.error('3. Check ARI credentials in /etc/asterisk/ari.conf');
        console.error('4. Ensure ARI_URL, ARI_USERNAME, ARI_PASSWORD are correct in .env');
        console.error('5. Test connection: curl -u username:password http://localhost:8088/ari/asterisk/info');
        process.exit(1);
    }
}

testConnection();
