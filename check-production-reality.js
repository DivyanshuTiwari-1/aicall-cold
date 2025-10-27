const {query} = require('./config/database');

(async () => {
  console.log('\n========================================');
  console.log('CHECKING PRODUCTION REALITY');
  console.log('========================================\n');

  // 1. Check recent calls
  console.log('1. RECENT CALLS (Last 24 hours):');
  const calls = await query(`
    SELECT
      c.id,
      c.status,
      c.automated,
      c.created_at,
      c.duration,
      ct.first_name,
      ct.last_name,
      ct.phone
    FROM calls c
    JOIN contacts ct ON c.contact_id = ct.id
    WHERE c.created_at > NOW() - INTERVAL '24 hours'
    ORDER BY c.created_at DESC
    LIMIT 10
  `);

  if (calls.rows.length === 0) {
    console.log('   ❌ NO CALLS in last 24 hours\n');
  } else {
    console.log(`   ✅ Found ${calls.rows.length} calls:\n`);
    calls.rows.forEach((c, i) => {
      console.log(`   ${i+1}. ${c.first_name} ${c.last_name} - ${c.phone}`);
      console.log(`      Status: ${c.status}, Automated: ${c.automated}, Duration: ${c.duration}s`);
      console.log(`      Created: ${new Date(c.created_at).toLocaleString()}`);
      console.log('');
    });
  }

  // 2. Check conversation data
  console.log('2. CONVERSATION DATA (Last 24 hours):');
  const conversations = await query(`
    SELECT
      ce.call_id,
      ce.event_type,
      ce.event_data,
      ce.created_at
    FROM call_events ce
    WHERE ce.created_at > NOW() - INTERVAL '24 hours'
    ORDER BY ce.created_at DESC
    LIMIT 10
  `);

  if (conversations.rows.length === 0) {
    console.log('   ❌ NO CONVERSATION DATA\n');
  } else {
    console.log(`   ✅ Found ${conversations.rows.length} conversation events:\n`);
    conversations.rows.forEach((c, i) => {
      console.log(`   ${i+1}. Call ID: ${c.call_id}`);
      console.log(`      Type: ${c.event_type}`);
      if (c.event_data.user_input) {
        console.log(`      Customer: "${c.event_data.user_input}"`);
      }
      if (c.event_data.ai_response) {
        console.log(`      AI: "${c.event_data.ai_response}"`);
      }
      console.log(`      Time: ${new Date(c.created_at).toLocaleString()}`);
      console.log('');
    });
  }

  // 3. Check queue activity
  console.log('3. CHECKING BACKEND LOGS FOR QUEUE ACTIVITY...');
  console.log('   (Check docker logs ai-dialer-backend for "Automated queue started")\n');

  // 4. Check Asterisk activity
  console.log('4. ASTERISK STATUS:');
  console.log('   (Check docker logs asterisk for call activity)\n');

  console.log('========================================');
  console.log('SUMMARY:');
  console.log(`Calls found: ${calls.rows.length}`);
  console.log(`Conversation events: ${conversations.rows.length}`);
  console.log('========================================\n');

  if (calls.rows.length === 0) {
    console.log('❌ NO REAL CALLS HAVE HAPPENED YET!');
    console.log('\nTo start calls:');
    console.log('1. Login to https://atsservice.site/');
    console.log('2. Go to Campaigns');
    console.log('3. Click "Start Automated Calls"');
  } else {
    console.log('✅ CALLS ARE HAPPENING!');
    if (conversations.rows.length > 0) {
      console.log('✅ CONVERSATIONS ARE BEING SAVED!');
    } else {
      console.log('⚠️  Calls exist but no conversation data saved');
    }
  }

  process.exit(0);
})();
