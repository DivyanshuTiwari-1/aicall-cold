const {query} = require('./config/database');

(async () => {
  console.log('\n=== STARTING REAL AI AUTOMATED CALLS ===\n');

  // Get Aicall campaign and phone number
  const campaign = await query(`
    SELECT id, name FROM campaigns
    WHERE name LIKE '%Aicall%' AND status = 'active'
    LIMIT 1
  `);

  const phoneNumber = await query(`
    SELECT id, phone_number FROM phone_numbers
    WHERE is_active = true
    LIMIT 1
  `);

  if (campaign.rows.length === 0 || phoneNumber.rows.length === 0) {
    console.log('ERROR: Campaign or phone number not found');
    process.exit(1);
  }

  const campaignId = campaign.rows[0].id;
  const phoneId = phoneNumber.rows[0].id;
  const phoneNum = phoneNumber.rows[0].phone_number;

  console.log(`Campaign: ${campaign.rows[0].name} (${campaignId})`);
  console.log(`Phone: ${phoneNum} (${phoneId})\n`);

  // Start the queue
  const { callQueue } = require('./services/queue');

  console.log('Starting queue...\n');
  await callQueue.startQueue(null, campaignId, phoneId, phoneNum);

  console.log('✅ Queue started! Calls will begin shortly...\n');
  console.log('Monitor with:');
  console.log('  docker logs ai-dialer-backend --follow');
  console.log('  docker logs asterisk --follow\n');

  // Keep process alive to monitor
  setInterval(() => {
    console.log(`[${new Date().toLocaleTimeString()}] Queue running...`);
  }, 10000);
})();
