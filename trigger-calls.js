const {query} = require('./config/database');
const {callQueue} = require('./services/queue');

(async () => {
    try {
        const campaigns = await query("SELECT id, name FROM campaigns WHERE status='active' LIMIT 1");
        const phones = await query("SELECT id, phone_number FROM phone_numbers WHERE is_active=true LIMIT 1");

        if (campaigns.rows.length === 0) {
            console.log('❌ No active campaigns');
            process.exit(1);
        }

        if (phones.rows.length === 0) {
            console.log('❌ No active phone numbers');
            process.exit(1);
        }

        const campaign = campaigns.rows[0];
        const phone = phones.rows[0];

        console.log(`✅ Campaign: ${campaign.name} (${campaign.id})`);
        console.log(`✅ Phone: ${phone.phone_number}`);
        console.log('\n🚀 Starting automated call queue...\n');

        await callQueue.startQueue(null, campaign.id, phone.id, phone.phone_number);

        console.log('✅ QUEUE STARTED! Calls will begin in 5 seconds.');
        console.log('\nMonitor live: docker logs -f ai-dialer-backend\n');

        // Keep alive for 5 minutes to watch calls
        setTimeout(() => {
            console.log('\n✅ Script complete. Queue continues running in background.');
            process.exit(0);
        }, 300000);

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
})();
