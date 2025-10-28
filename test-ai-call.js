const { query } = require('./config/database');
const telnyxCallControl = require('./services/telnyx-call-control');
const { v4: uuidv4 } = require('uuid');

async function makeRealAICall() {
  try {
    console.log('\n================================================');
    console.log('🤖 AI AUTOMATED CALL TEST - PRODUCTION');
    console.log('================================================\n');

    // Get active campaign
    const campaign = await query(`SELECT id, name, organization_id FROM campaigns WHERE status = 'active' LIMIT 1`);
    if (!campaign.rows[0]) throw new Error('No active campaign found');

    const campaignId = campaign.rows[0].id;
    const orgId = campaign.rows[0].organization_id;

    console.log('📋 Campaign:', campaign.rows[0].name);
    console.log('🏢 Organization ID:', orgId);

    // Test phone numbers
    const testPhone = '2023214227';
    const fromNumber = '+18058690081';

    console.log('📞 From:', fromNumber);
    console.log('📞 To:', testPhone);
    console.log('');

    // Create or update test contact
    let contact = await query(`SELECT * FROM contacts WHERE phone = $1 AND organization_id = $2`, [testPhone, orgId]);

    if (contact.rows.length === 0) {
      console.log('👤 Creating new test contact...');
      contact = await query(`
        INSERT INTO contacts (organization_id, campaign_id, first_name, last_name, phone, status, email)
        VALUES ($1, $2, 'Test', 'AICall', $3, 'new', 'test@test.com')
        RETURNING *
      `, [orgId, campaignId, testPhone]);
    } else {
      console.log('👤 Using existing contact...');
      await query(`UPDATE contacts SET status = 'new', campaign_id = $1 WHERE id = $2`, [campaignId, contact.rows[0].id]);
      contact = await query(`SELECT * FROM contacts WHERE id = $1`, [contact.rows[0].id]);
    }

    const contactData = contact.rows[0];
    console.log('✅ Contact ready:', contactData.first_name, contactData.last_name);
    console.log('');

    // Create call record
    const callId = uuidv4();
    console.log('🆔 Call ID:', callId);

    await query(`
      INSERT INTO calls (
        id, organization_id, campaign_id, contact_id,
        status, initiated_by, automated, from_number, to_number,
        created_at
      ) VALUES ($1, $2, $3, $4, 'initiated', NULL, true, $5, $6, CURRENT_TIMESTAMP)
    `, [callId, orgId, campaignId, contactData.id, fromNumber, testPhone]);

    console.log('✅ Call record created in database');
    console.log('');

    // Make the actual call via Telnyx
    console.log('🎯 Initiating Telnyx Call Control API...');

    const result = await telnyxCallControl.makeAICall({
      callId: callId,
      contact: {
        id: contactData.id,
        first_name: contactData.first_name,
        last_name: contactData.last_name,
        phone: testPhone,
        organization_id: orgId
      },
      campaignId: campaignId,
      fromNumber: fromNumber
    });

    console.log('');
    console.log('✅✅✅ CALL INITIATED SUCCESSFULLY! ✅✅✅');
    console.log('');
    console.log('Call Control ID:', result.callControlId);
    console.log('Telnyx Call ID:', result.telnyxCallId);
    console.log('');
    console.log('================================================');
    console.log('📊 MONITORING STARTED');
    console.log('================================================');
    console.log('');
    console.log('The call should now be ringing...');
    console.log('When answered, AI will start conversation');
    console.log('');
    console.log('Monitor backend logs: docker-compose logs -f backend');
    console.log('Check database: SELECT * FROM calls WHERE id = \'' + callId + '\'');
    console.log('');
    console.log('Monitoring for 90 seconds...');
    console.log('');

    // Monitor every 10 seconds
    let count = 0;
    const interval = setInterval(async () => {
      count++;
      console.log(`\n[${count}] Checking call status...`);

      const callStatus = await query('SELECT status, outcome, duration FROM calls WHERE id = $1', [callId]);
      if (callStatus.rows[0]) {
        console.log('   Status:', callStatus.rows[0].status);
        console.log('   Outcome:', callStatus.rows[0].outcome || 'N/A');
        console.log('   Duration:', (callStatus.rows[0].duration || 0) + 's');
      }

      // Check for conversation events
      const events = await query(`
        SELECT event_type, timestamp
        FROM call_events
        WHERE call_id = $1
        ORDER BY timestamp DESC
        LIMIT 5
      `, [callId]);

      if (events.rows.length > 0) {
        console.log('   Events:', events.rows.length);
        events.rows.forEach(e => {
          console.log('     -', e.event_type, 'at', new Date(e.timestamp).toLocaleTimeString());
        });
      }
    }, 10000);

    // Check final results after 90 seconds
    setTimeout(async () => {
      clearInterval(interval);
      console.log('\n\n================================================');
      console.log('📈 FINAL RESULTS');
      console.log('================================================\n');

      const finalCall = await query('SELECT * FROM calls WHERE id = $1', [callId]);
      const callData = finalCall.rows[0];

      console.log('Call ID:', callId);
      console.log('Status:', callData.status);
      console.log('Outcome:', callData.outcome || 'N/A');
      console.log('Duration:', (callData.duration || 0) + ' seconds');
      console.log('Cost: $' + (callData.cost || '0.00'));
      console.log('');

      // Get conversation events
      const convEvents = await query(`
        SELECT event_type, event_data, timestamp
        FROM call_events
        WHERE call_id = $1 AND event_type = 'ai_conversation'
        ORDER BY timestamp ASC
      `, [callId]);

      console.log('Conversation Turns:', convEvents.rows.length);
      console.log('');

      if (convEvents.rows.length > 0) {
        console.log('CONVERSATION TRANSCRIPT:');
        console.log('========================\n');
        convEvents.rows.forEach((e, idx) => {
          const data = e.event_data;
          console.log(`Turn ${idx + 1}:`);
          if (data.user_input) console.log(`  👤 Customer: ${data.user_input}`);
          if (data.ai_response) console.log(`  🤖 AI: ${data.ai_response}`);
          if (data.emotion) console.log(`  😊 Emotion: ${data.emotion}`);
          if (data.intent) console.log(`  🎯 Intent: ${data.intent}`);
          console.log('');
        });
      }

      if (callData.transcript) {
        console.log('\nFULL TRANSCRIPT:');
        console.log('================');
        console.log(callData.transcript);
      }

      console.log('\n✅ Test completed!');
      process.exit(0);
    }, 90000);

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

console.log('Starting AI call test...');
makeRealAICall();
