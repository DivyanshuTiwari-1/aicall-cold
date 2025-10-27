const {query} = require('./config/database');
const {callQueue} = require('./services/queue');
const logger = require('./utils/logger');

async function testAICalls() {
    try {
        console.log('\n========== AI CALLS END-TO-END TEST ==========\n');

        // 1. Get active campaign and phone
        const campaigns = await query("SELECT id, name FROM campaigns WHERE status='active' LIMIT 1");
        const phones = await query("SELECT id, phone_number FROM phone_numbers WHERE is_active=true LIMIT 1");

        if (campaigns.rows.length === 0 || phones.rows.length === 0) {
            console.log('❌ No active campaign or phone number');
            process.exit(1);
        }

        const campaign = campaigns.rows[0];
        const phone = phones.rows[0];

        console.log(`Campaign: ${campaign.name}`);
        console.log(`Phone: ${phone.phone_number}\n`);

        // 2. Get contacts to call
        const contacts = await query(`
            SELECT id, first_name, last_name, phone, status
            FROM contacts
            WHERE campaign_id = $1 AND status IN ('pending', 'new')
            ORDER BY created_at ASC
            LIMIT 3
        `, [campaign.id]);

        console.log(`Found ${contacts.rows.length} contacts to call:\n`);
        contacts.rows.forEach((c, i) => {
            console.log(`${i+1}. ${c.first_name} ${c.last_name} - ${c.phone} (${c.status})`);
        });

        // 3. Start queue
        console.log('\n🚀 Starting automated call queue...\n');
        await callQueue.startQueue(null, campaign.id, phone.id, phone.phone_number);
        console.log('✅ Queue STARTED!\n');

        // 4. Monitor for 90 seconds
        console.log('⏱️  Monitoring calls for 90 seconds...\n');

        let checkCount = 0;
        const monitor = setInterval(async () => {
            try {
                checkCount++;

                // Check recent calls
                const recentCalls = await query(`
                    SELECT id, status, to_number, created_at
                    FROM calls
                    WHERE created_at > NOW() - INTERVAL '2 minutes'
                    ORDER BY created_at DESC
                `);

                if (recentCalls.rows.length > 0) {
                    console.log(`\n[${new Date().toLocaleTimeString()}] 📞 Found ${recentCalls.rows.length} calls:`);
                    recentCalls.rows.forEach(call => {
                        console.log(`  - ${call.to_number}: ${call.status} (${new Date(call.created_at).toLocaleTimeString()})`);
                    });

                    // Check for conversations
                    const conversations = await query(`
                        SELECT call_id, event_type, event_data
                        FROM call_events
                        WHERE call_id = ANY($1) AND event_type = 'ai_conversation'
                        LIMIT 5
                    `, [recentCalls.rows.map(c => c.id)]);

                    if (conversations.rows.length > 0) {
                        console.log(`\n  💬 Conversations found: ${conversations.rows.length}`);
                        conversations.rows.forEach(conv => {
                            const data = conv.event_data;
                            if (data.user_input) console.log(`    User: ${data.user_input.substring(0, 50)}`);
                            if (data.ai_response) console.log(`    AI: ${data.ai_response.substring(0, 50)}`);
                        });
                    }
                }

                if (checkCount >= 6) {  // 90 seconds = 6 checks at 15s intervals
                    clearInterval(monitor);

                    // Final summary
                    console.log('\n\n========== FINAL SUMMARY ==========\n');

                    const finalCalls = await query(`
                        SELECT id, status, outcome, duration, to_number
                        FROM calls
                        WHERE created_at > NOW() - INTERVAL '2 minutes'
                    `);

                    console.log(`Total calls initiated: ${finalCalls.rows.length}`);

                    if (finalCalls.rows.length > 0) {
                        const completed = finalCalls.rows.filter(c => c.status === 'completed').length;
                        const inProgress = finalCalls.rows.filter(c => c.status === 'in_progress').length;
                        const initiated = finalCalls.rows.filter(c => c.status === 'initiated').length;

                        console.log(`  - Completed: ${completed}`);
                        console.log(`  - In Progress: ${inProgress}`);
                        console.log(`  - Initiated: ${initiated}`);

                        // Check conversations
                        const convCount = await query(`
                            SELECT COUNT(*) as count
                            FROM call_events
                            WHERE call_id = ANY($1) AND event_type = 'ai_conversation'
                        `, [finalCalls.rows.map(c => c.id)]);

                        console.log(`\nConversation turns: ${convCount.rows[0].count}`);

                        if (convCount.rows[0].count > 0) {
                            console.log('\n✅ SUCCESS! AI calls are working - conversations are being saved!');
                        } else if (finalCalls.rows.length > 0) {
                            console.log('\n⚠️  Calls initiated but no AI conversations found');
                            console.log('Check: TTS/STT services, FastAGI connection, Asterisk routing');
                        }
                    } else {
                        console.log('\n❌ No calls were initiated');
                        console.log('Check: ARI connection, Telnyx trunk, queue processing');
                    }

                    process.exit(0);
                }
            } catch (err) {
                console.error('Monitor error:', err.message);
            }
        }, 15000);  // Check every 15 seconds

    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

testAICalls();
