#!/usr/bin/env node

/**
 * AI Call Tracking Validation Script
 *
 * This script tests:
 * 1. Fetching automated calls
 * 2. Viewing call conversations
 * 3. Filtering by call type
 * 4. Queue status checking
 */

const axios = require('axios');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const BASE_URL = process.env.API_URL || 'http://localhost:5000/api';
let authToken = '';

// Color output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function ask(question) {
    return new Promise(resolve => rl.question(question, resolve));
}

// 1. Login
async function login() {
    log('\n📋 Step 1: Login', 'cyan');
    const email = await ask('Enter your email: ');
    const password = await ask('Enter your password: ');

    try {
        const response = await axios.post(`${BASE_URL}/auth/login`, {
            email,
            password
        });

        authToken = response.data.token;
        log('✅ Login successful!', 'green');
        return true;
    } catch (error) {
        log('❌ Login failed: ' + error.response?.data?.message, 'red');
        return false;
    }
}

// 2. Fetch all calls
async function fetchCalls(callType = '') {
    log('\n📞 Fetching calls...', 'cyan');

    try {
        const params = {};
        if (callType) params.callType = callType;

        const response = await axios.get(`${BASE_URL}/calls`, {
            headers: { Authorization: `Bearer ${authToken}` },
            params
        });

        const calls = response.data.calls || [];
        log(`✅ Found ${calls.length} calls`, 'green');

        if (calls.length > 0) {
            log('\nCall Summary:', 'yellow');
            calls.slice(0, 5).forEach((call, idx) => {
                const typeEmoji = call.callType === 'automated' ? '🤖' : '👤';
                log(`  ${idx + 1}. ${typeEmoji} ${call.contactName} - ${call.outcome || 'N/A'} - ${call.duration || 0}s`);
            });
        }

        return calls;
    } catch (error) {
        log('❌ Failed to fetch calls: ' + error.response?.data?.message, 'red');
        return [];
    }
}

// 3. Fetch automated calls only
async function fetchAutomatedCalls() {
    log('\n🤖 Fetching AUTOMATED calls only...', 'cyan');
    return await fetchCalls('automated');
}

// 4. View conversation for a call
async function viewConversation(callId) {
    log(`\n💬 Fetching conversation for call ${callId}...`, 'cyan');

    try {
        const response = await axios.get(`${BASE_URL}/calls/${callId}/conversation`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });

        const data = response.data;
        log('✅ Conversation retrieved!', 'green');

        if (data.call) {
            log('\n📊 Call Details:', 'yellow');
            log(`  Contact: ${data.call.contactName}`);
            log(`  Duration: ${data.call.duration || 0}s`);
            log(`  Emotion: ${data.call.emotion || 'N/A'}`);
            log(`  Outcome: ${data.call.status}`);
        }

        if (data.conversationHistory && data.conversationHistory.length > 0) {
            log('\n💬 Conversation:', 'magenta');
            data.conversationHistory.forEach((msg, idx) => {
                const speaker = msg.speaker === 'customer' ? '👤 Customer' : '🤖 AI';
                const text = msg.message || msg.user_input || msg.ai_response;
                log(`  ${speaker}: ${text}`);
            });
        } else if (data.call?.transcript) {
            log('\n💬 Transcript:', 'magenta');
            log(data.call.transcript);
        } else {
            log('  No conversation data available', 'yellow');
        }

        return data;
    } catch (error) {
        log('❌ Failed to fetch conversation: ' + error.response?.data?.message, 'red');
        return null;
    }
}

// 5. Check queue status for a campaign
async function checkQueueStatus() {
    log('\n⏱️  Checking queue status...', 'cyan');
    const campaignId = await ask('Enter campaign ID (or press Enter to skip): ');

    if (!campaignId) {
        log('Skipped', 'yellow');
        return;
    }

    try {
        const response = await axios.get(`${BASE_URL}/calls/queue/status/${campaignId}`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });

        const status = response.data.status;
        log('✅ Queue Status:', 'green');
        log(`  Status: ${status?.status || 'idle'}`);
        log(`  Active Calls: ${status?.activeCalls || 0}`);
        log(`  Queue Size: ${status?.queueSize || 0}`);
    } catch (error) {
        log('❌ Failed to check queue status: ' + error.response?.data?.message, 'red');
    }
}

// 6. Stop automated calling
async function stopAutomatedCalling() {
    log('\n🛑 Stopping automated calling...', 'cyan');
    const campaignId = await ask('Enter campaign ID to stop: ');

    if (!campaignId) {
        log('Skipped', 'yellow');
        return;
    }

    try {
        const response = await axios.post(`${BASE_URL}/calls/automated/stop`,
            { campaignId },
            { headers: { Authorization: `Bearer ${authToken}` } }
        );

        log('✅ Automated calling stopped successfully!', 'green');
        log(`  Campaign: ${campaignId}`);
    } catch (error) {
        log('❌ Failed to stop: ' + error.response?.data?.message, 'red');
    }
}

// Main test flow
async function runTests() {
    log('╔════════════════════════════════════════════════╗', 'cyan');
    log('║   AI Call Tracking Validation Script          ║', 'cyan');
    log('╚════════════════════════════════════════════════╝', 'cyan');

    // Step 1: Login
    const loginSuccess = await login();
    if (!loginSuccess) {
        rl.close();
        return;
    }

    // Step 2: Fetch all calls
    const allCalls = await fetchCalls();

    // Step 3: Fetch automated calls only
    const automatedCalls = await fetchAutomatedCalls();

    // Step 4: View a conversation
    if (automatedCalls.length > 0) {
        log('\n🔍 Testing conversation viewing...', 'cyan');
        const testCall = automatedCalls[0];
        log(`Selected call: ${testCall.contactName} (${testCall.id})`, 'yellow');
        await viewConversation(testCall.id);
    } else {
        log('\n⚠️  No automated calls found to test conversation viewing', 'yellow');
    }

    // Step 5: Check queue status
    await checkQueueStatus();

    // Step 6: Stop automated calling (optional)
    const shouldStop = await ask('\nDo you want to stop an automated campaign? (y/n): ');
    if (shouldStop.toLowerCase() === 'y') {
        await stopAutomatedCalling();
    }

    // Summary
    log('\n╔════════════════════════════════════════════════╗', 'green');
    log('║              VALIDATION SUMMARY                 ║', 'green');
    log('╚════════════════════════════════════════════════╝', 'green');
    log(`✅ Total calls found: ${allCalls.length}`, 'green');
    log(`✅ Automated calls: ${automatedCalls.length}`, 'green');
    log(`✅ Manual calls: ${allCalls.length - automatedCalls.length}`, 'green');

    if (automatedCalls.length > 0) {
        const withTranscript = automatedCalls.filter(c => c.transcript && c.transcript.length > 0);
        log(`✅ Calls with transcripts: ${withTranscript.length}`, 'green');
    }

    log('\n🎉 Validation complete!', 'green');
    log('\nNext steps:', 'cyan');
    log('  1. Go to Call History page in your dashboard');
    log('  2. Use "Call Type" filter to select "🤖 AI Automated"');
    log('  3. Click "View" on any call to see the conversation');
    log('  4. To stop automated calling, go to Campaigns page and click "Stop"');

    rl.close();
}

// Error handling
process.on('unhandledRejection', (error) => {
    log(`\n❌ Unhandled error: ${error.message}`, 'red');
    rl.close();
    process.exit(1);
});

// Run the tests
runTests().catch(error => {
    log(`\n❌ Test failed: ${error.message}`, 'red');
    rl.close();
    process.exit(1);
});
