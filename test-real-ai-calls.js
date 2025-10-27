#!/usr/bin/env node
/**
 * Test REAL AI Automated Calls - Complete Flow
 * This will actually initiate 5 REAL calls to customers
 */

const { query } = require('./config/database');
const axios = require('axios');

async function testRealAICalls() {
    console.log('========================================');
    console.log('🤖 TESTING REAL AI AUTOMATED CALLS');
    console.log('========================================\n');

    try {
        // 1. Get campaign and contacts
        console.log('1️⃣  Finding campaign and contacts for testing...');
        const campaigns = await query(`
            SELECT
                c.id,
                c.name,
                COUNT(ct.id) as contact_count
            FROM campaigns c
            LEFT JOIN contacts ct ON c.id = ct.campaign_id
                AND ct.status IN ('pending', 'new', 'retry')
            WHERE c.status = 'active'
            GROUP BY c.id, c.name
            HAVING COUNT(ct.id) >= 5
            ORDER BY COUNT(ct.id) DESC
            LIMIT 1
        `);

        if (campaigns.rows.length === 0) {
            console.log('❌ No campaign with at least 5 contacts');
            process.exit(1);
        }

        const campaign = campaigns.rows[0];
        console.log(`✅ Campaign: ${campaign.name}`);
        console.log(`   Ready contacts: ${campaign.contact_count}\n`);

        // 2. Get phone number
        console.log('2️⃣  Getting phone number...');
        const phoneNumbers = await query(`
            SELECT id, phone_number
            FROM phone_numbers
            WHERE is_active = true
            LIMIT 1
        `);

        if (phoneNumbers.rows.length === 0) {
            console.log('❌ No active phone numbers');
            process.exit(1);
        }

        const phoneNumber = phoneNumbers.rows[0];
        console.log(`✅ Using: ${phoneNumber.phone_number}\n`);

        // 3. Start automated call queue via API
        console.log('3️⃣  Starting automated call queue...');
        console.log('   This will initiate 5 REAL calls to customers!\n');

        try {
            // Get a valid auth token first
            const loginResponse = await axios.post('http://localhost:3000/api/v1/auth/login', {
                email: 'admin@demo.com',
                password: 'Admin123!'
            });

            const token = loginResponse.data.token;
            console.log('✅ Authenticated successfully\n');

            // Start automated calls
            const startResponse = await axios.post(
                'http://localhost:3000/api/v1/calls/automated/start',
                {
                    campaignId: campaign.id,
                    phoneNumberId: phoneNumber.id
                },
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            );

            console.log('✅ Queue started successfully!');
            console.log(`   Campaign: ${campaign.name}`);
            console.log(`   Phone: ${phoneNumber.phone_number}\n`);

        } catch (apiError) {
            if (apiError.response) {
                console.log('❌ API Error:', apiError.response.data);
            } else {
                console.log('❌ API Error:', apiError.message);
            }
        }

        // 4. Monitor calls for 2 minutes
        console.log('4️⃣  Monitoring calls (120 seconds)...\n');

        const monitorStart = Date.now();
        const monitorDuration = 120000; // 2 minutes
        let lastCallCount = 0;

        while (Date.now() - monitorStart < monitorDuration) {
            // Check active calls
            const activeCalls = await query(`
                SELECT
                    c.id,
                    c.status,
                    c.duration,
                    c.automated,
                    ct.first_name,
                    ct.last_name,
                    ct.phone,
                    c.created_at
                FROM calls c
                JOIN contacts ct ON c.contact_id = ct.id
                WHERE c.campaign_id = $1
                AND c.automated = true
                AND c.created_at > NOW() - INTERVAL '5 minutes'
                ORDER BY c.created_at DESC
                LIMIT 10
            `, [campaign.id]);

            if (activeCalls.rows.length > lastCallCount) {
                console.log(`\n📞 New call detected! Total: ${activeCalls.rows.length}`);
                const latestCall = activeCalls.rows[0];
                console.log(`   Contact: ${latestCall.first_name} ${latestCall.last_name}`);
                console.log(`   Phone: ${latestCall.phone}`);
                console.log(`   Status: ${latestCall.status}`);
                console.log(`   Call ID: ${latestCall.id}`);
            }

            lastCallCount = activeCalls.rows.length;

            // Check for conversation data
            const conversationCheck = await query(`
                SELECT
                    ce.call_id,
                    ce.event_type,
                    ce.event_data->>'user_input' as user_input,
                    ce.event_data->>'ai_response' as ai_response,
                    ce.created_at
                FROM call_events ce
                WHERE ce.event_type = 'ai_conversation'
                AND ce.created_at > NOW() - INTERVAL '5 minutes'
                ORDER BY ce.created_at DESC
                LIMIT 5
            `);

            if (conversationCheck.rows.length > 0) {
                console.log(`\n💬 Conversation activity detected! (${conversationCheck.rows.length} turns)`);
                conversationCheck.rows.forEach((turn, i) => {
                    if (turn.user_input) {
                        console.log(`   Customer: ${turn.user_input.substring(0, 60)}...`);
                    }
                    if (turn.ai_response) {
                        console.log(`   AI: ${turn.ai_response.substring(0, 60)}...`);
                    }
                });
            }

            // Wait 10 seconds before next check
            await new Promise(resolve => setTimeout(resolve, 10000));
        }

        // 5. Final results
        console.log('\n\n========================================');
        console.log('📊 FINAL RESULTS');
        console.log('========================================\n');

        // Get all calls from this test
        const testCalls = await query(`
            SELECT
                c.id,
                c.status,
                c.duration,
                c.outcome,
                ct.first_name,
                ct.last_name,
                ct.phone,
                c.created_at,
                c.updated_at
            FROM calls c
            JOIN contacts ct ON c.contact_id = ct.id
            WHERE c.campaign_id = $1
            AND c.automated = true
            AND c.created_at > NOW() - INTERVAL '5 minutes'
            ORDER BY c.created_at DESC
        `, [campaign.id]);

        console.log(`Total calls initiated: ${testCalls.rows.length}\n`);

        testCalls.rows.forEach((call, i) => {
            console.log(`Call ${i + 1}:`);
            console.log(`  Contact: ${call.first_name} ${call.last_name} (${call.phone})`);
            console.log(`  Status: ${call.status}`);
            console.log(`  Duration: ${call.duration || 0} seconds`);
            console.log(`  Outcome: ${call.outcome || 'N/A'}`);
            console.log(`  Started: ${new Date(call.created_at).toLocaleTimeString()}`);
            console.log('');
        });

        // Check conversation data for each call
        console.log('📝 Conversation Data Saved:\n');

        for (const call of testCalls.rows) {
            const conversationData = await query(`
                SELECT
                    event_type,
                    event_data,
                    created_at
                FROM call_events
                WHERE call_id = $1
                ORDER BY created_at ASC
            `, [call.id]);

            console.log(`Call ${call.id}:`);
            console.log(`  Total events: ${conversationData.rows.length}`);

            const aiConversations = conversationData.rows.filter(e => e.event_type === 'ai_conversation');
            console.log(`  AI conversation turns: ${aiConversations.length}`);

            if (aiConversations.length > 0) {
                console.log('  Sample conversation:');
                aiConversations.slice(0, 2).forEach((turn, i) => {
                    const data = turn.event_data;
                    if (data.user_input) {
                        console.log(`    Customer: ${data.user_input.substring(0, 50)}...`);
                    }
                    if (data.ai_response) {
                        console.log(`    AI: ${data.ai_response.substring(0, 50)}...`);
                    }
                });
            }
            console.log('');
        }

        // Summary
        const completedCalls = testCalls.rows.filter(c => c.status === 'completed').length;
        const inProgressCalls = testCalls.rows.filter(c => c.status === 'in_progress').length;
        const failedCalls = testCalls.rows.filter(c => c.status === 'failed').length;

        console.log('========================================');
        console.log('📊 SUMMARY');
        console.log('========================================');
        console.log(`Total calls: ${testCalls.rows.length}`);
        console.log(`Completed: ${completedCalls}`);
        console.log(`In Progress: ${inProgressCalls}`);
        console.log(`Failed: ${failedCalls}`);
        console.log('');
        console.log(testCalls.rows.length >= 5 ? '✅ TEST PASSED - 5+ calls initiated' : '⚠️  Less than 5 calls initiated');
        console.log('========================================\n');

        process.exit(0);

    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

testRealAICalls();
