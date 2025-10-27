const {query} = require('./config/database');

(async () => {
  console.log('\n========== CHECKING FOR REAL AI CONVERSATIONS ==========\n');

  // Check for actual AI conversation turns
  const aiConversations = await query(`
    SELECT
      ce.call_id,
      ce.event_type,
      ce.event_data,
      ce.created_at,
      c.status,
      ct.first_name,
      ct.phone
    FROM call_events ce
    JOIN calls c ON ce.call_id = c.id
    JOIN contacts ct ON c.contact_id = ct.id
    WHERE ce.event_type = 'ai_conversation'
    AND ce.created_at > NOW() - INTERVAL '7 days'
    ORDER BY ce.created_at DESC
    LIMIT 20
  `);

  console.log(`Found ${aiConversations.rows.length} AI conversation turns\n`);

  if (aiConversations.rows.length === 0) {
    console.log('❌ NO REAL AI CONVERSATIONS FOUND!');
    console.log('\nThis means:');
    console.log('- Calls may be initiated but not answered');
    console.log('- OR AGI script is not running');
    console.log('- OR TTS/STT services not working');
    console.log('- OR Asterisk not routing to FastAGI');
  } else {
    console.log('✅ REAL AI CONVERSATIONS FOUND!\n');
    aiConversations.rows.forEach((conv, i) => {
      console.log(`${i+1}. Contact: ${conv.first_name} - ${conv.phone}`);
      console.log(`   Call ID: ${conv.call_id}`);
      const data = conv.event_data;
      if (data.user_input) {
        console.log(`   👤 Customer said: "${data.user_input}"`);
      }
      if (data.ai_response) {
        console.log(`   🤖 AI responded: "${data.ai_response}"`);
      }
      if (data.emotion) {
        console.log(`   😊 Emotion: ${data.emotion}`);
      }
      console.log(`   🕐 Time: ${new Date(conv.created_at).toLocaleString()}\n`);
    });
  }

  // Check backend logs for AGI activity
  console.log('\n========== CHECKING SYSTEM STATUS ==========\n');

  // Check if FastAGI server is running
  const net = require('net');
  console.log('Testing FastAGI Server...');
  try {
    await new Promise((resolve, reject) => {
      const client = net.createConnection({ port: 4573, host: 'localhost' }, () => {
        console.log('✅ FastAGI Server is RUNNING on port 4573\n');
        client.end();
        resolve();
      });
      client.on('error', (err) => {
        console.log(`❌ FastAGI Server ERROR: ${err.message}\n`);
        reject(err);
      });
      setTimeout(() => {
        client.destroy();
        reject(new Error('Timeout'));
      }, 3000);
    });
  } catch(e) {
    console.log('⚠️  FastAGI Server not accessible\n');
  }

  // Check recent automated calls status
  console.log('Recent Automated Calls Status:');
  const recentAutomated = await query(`
    SELECT
      c.id,
      c.status,
      c.outcome,
      c.duration,
      c.created_at,
      ct.first_name,
      ct.phone
    FROM calls c
    JOIN contacts ct ON c.contact_id = ct.id
    WHERE c.automated = true
    AND c.created_at > NOW() - INTERVAL '24 hours'
    ORDER BY c.created_at DESC
    LIMIT 5
  `);

  recentAutomated.rows.forEach((call, i) => {
    console.log(`${i+1}. ${call.first_name} (${call.phone})`);
    console.log(`   Status: ${call.status}, Duration: ${call.duration}s`);
    console.log(`   Outcome: ${call.outcome || 'N/A'}`);
    console.log(`   Time: ${new Date(call.created_at).toLocaleString()}\n`);
  });

  process.exit(0);
})();
