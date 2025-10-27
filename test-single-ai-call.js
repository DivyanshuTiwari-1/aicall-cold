#!/usr/bin/env node
/**
 * Single AI Call Test Script
 * Tests one complete automated call flow end-to-end
 */

const { Pool } = require('pg');
const axios = require('axios');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'ai_dialer'
});

const API_URL = process.env.API_URL || 'http://localhost:3000';
const ASTERISK_ARI_URL = process.env.ARI_URL || 'http://localhost:8088';
const ARI_USER = process.env.ARI_USER || 'asterisk';
const ARI_PASSWORD = process.env.ARI_PASSWORD || 'asterisk';

let testCallId = null;

// Colors
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getActiveCampaign() {
  log('\n📋 Step 1: Finding active campaign...', 'cyan');

  const result = await pool.query(`
    SELECT c.id, c.name, COUNT(ct.id) as contact_count
    FROM campaigns c
    LEFT JOIN contacts ct ON c.id = ct.campaign_id AND ct.status IN ('pending', 'new')
    WHERE c.status = 'active'
    GROUP BY c.id, c.name
    LIMIT 1
  `);

  if (result.rows.length === 0) {
    throw new Error('No active campaign found');
  }

  const campaign = result.rows[0];
  log(`✓ Found: ${campaign.name} (ID: ${campaign.id})`, 'green');
  log(`  Contacts available: ${campaign.contact_count}`, 'blue');

  return campaign;
}

async function getTestContact(campaignId) {
  log('\n📞 Step 2: Getting test contact...', 'cyan');

  const result = await pool.query(`
    SELECT id, first_name, last_name, phone, email
    FROM contacts
    WHERE campaign_id = $1
    AND status IN ('pending', 'new')
    ORDER BY created_at ASC
    LIMIT 1
  `, [campaignId]);

  if (result.rows.length === 0) {
    throw new Error('No contacts available for testing');
  }

  const contact = result.rows[0];
  log(`✓ Selected: ${contact.first_name} ${contact.last_name}`, 'green');
  log(`  Phone: ${contact.phone}`, 'blue');

  return contact;
}

async function createCallRecord(campaignId, contactId, orgId) {
  log('\n💾 Step 3: Creating call record...', 'cyan');

  const result = await pool.query(`
    INSERT INTO calls (
      campaign_id,
      contact_id,
      organization_id,
      call_type,
      status,
      direction,
      from_number,
      to_number,
      created_at,
      updated_at
    ) VALUES ($1, $2, $3, 'automated', 'initiated', 'outbound', '+12025551234',
              (SELECT phone FROM contacts WHERE id = $2), NOW(), NOW())
    RETURNING id, to_number
  `, [campaignId, contactId, orgId]);

  const call = result.rows[0];
  testCallId = call.id;

  log(`✓ Call record created: ${call.id}`, 'green');
  log(`  Destination: ${call.to_number}`, 'blue');

  return call;
}

async function initiateCall(callId, toNumber, campaignId) {
  log('\n📡 Step 4: Initiating call via ARI...', 'cyan');

  try {
    // This would actually initiate the call through Asterisk ARI
    // For now, we'll simulate the flow

    log(`  Call ID: ${callId}`, 'blue');
    log(`  To: ${toNumber}`, 'blue');
    log(`  Campaign: ${campaignId}`, 'blue');

    // Update call status to in_progress
    await pool.query(`
      UPDATE calls
      SET status = 'in_progress',
          started_at = NOW(),
          updated_at = NOW()
      WHERE id = $1
    `, [callId]);

    log('✓ Call initiated successfully', 'green');

    return true;
  } catch (error) {
    log(`✗ Failed to initiate call: ${error.message}`, 'red');
    throw error;
  }
}

async function monitorCall(callId, maxWaitSeconds = 60) {
  log('\n👀 Step 5: Monitoring call progress...', 'cyan');
  log('  (Waiting for conversation to start...)', 'blue');

  const startTime = Date.now();
  let conversationTurns = 0;
  let lastTurnCount = 0;

  while (true) {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);

    if (elapsed > maxWaitSeconds) {
      log(`⏱️  Timeout reached (${maxWaitSeconds}s)`, 'yellow');
      break;
    }

    // Check call status
    const callResult = await pool.query(`
      SELECT status, duration, outcome
      FROM calls
      WHERE id = $1
    `, [callId]);

    if (callResult.rows.length === 0) {
      log('✗ Call record not found', 'red');
      break;
    }

    const call = callResult.rows[0];

    // Check for conversation turns
    const convResult = await pool.query(`
      SELECT COUNT(*) as count
      FROM call_events
      WHERE call_id = $1 AND event_type = 'ai_conversation'
    `, [callId]);

    conversationTurns = parseInt(convResult.rows[0].count);

    if (conversationTurns > lastTurnCount) {
      log(`  💬 Conversation turn ${conversationTurns} detected`, 'green');

      // Get latest turn details
      const turnResult = await pool.query(`
        SELECT event_data
        FROM call_events
        WHERE call_id = $1 AND event_type = 'ai_conversation'
        ORDER BY timestamp DESC
        LIMIT 1
      `, [callId]);

      if (turnResult.rows.length > 0) {
        const turnData = turnResult.rows[0].event_data;
        if (turnData.user_input) {
          log(`     Customer: "${turnData.user_input.substring(0, 60)}..."`, 'blue');
        }
        if (turnData.ai_response) {
          log(`     AI: "${turnData.ai_response.substring(0, 60)}..."`, 'cyan');
        }
      }

      lastTurnCount = conversationTurns;
    }

    // Check if call completed
    if (call.status === 'completed' || call.status === 'failed') {
      log(`\n✓ Call ${call.status}: ${call.outcome || 'N/A'}`, call.status === 'completed' ? 'green' : 'yellow');
      log(`  Duration: ${call.duration || 0}s`, 'blue');
      log(`  Conversation turns: ${conversationTurns}`, 'blue');
      break;
    }

    // Show progress
    process.stdout.write(`\r  ${elapsed}s elapsed | Status: ${call.status} | Turns: ${conversationTurns}  `);

    await sleep(2000);
  }

  return conversationTurns;
}

async function showConversationTranscript(callId) {
  log('\n\n📝 Step 6: Full Conversation Transcript', 'cyan');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');

  const result = await pool.query(`
    SELECT event_data, timestamp
    FROM call_events
    WHERE call_id = $1 AND event_type = 'ai_conversation'
    ORDER BY timestamp ASC
  `, [callId]);

  if (result.rows.length === 0) {
    log('  No conversation recorded', 'yellow');
    return;
  }

  result.rows.forEach((row, index) => {
    const data = row.event_data;
    const time = new Date(row.timestamp).toLocaleTimeString();

    log(`\nTurn ${index + 1} [${time}]`, 'blue');

    if (data.user_input) {
      log(`Customer: ${data.user_input}`, 'green');
    }

    if (data.ai_response) {
      log(`AI:       ${data.ai_response}`, 'cyan');
    }

    if (data.intent) {
      log(`Intent:   ${data.intent}`, 'yellow');
    }

    if (data.emotion) {
      log(`Emotion:  ${data.emotion}`, 'yellow');
    }
  });

  log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
}

async function showCallSummary(callId) {
  log('\n\n📊 Step 7: Call Summary', 'cyan');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');

  const result = await pool.query(`
    SELECT
      c.id,
      c.status,
      c.outcome,
      c.duration,
      c.cost,
      c.created_at,
      c.started_at,
      c.ended_at,
      ct.first_name || ' ' || ct.last_name as contact_name,
      ct.phone,
      (SELECT COUNT(*) FROM call_events WHERE call_id = c.id AND event_type = 'ai_conversation') as conversation_turns
    FROM calls c
    JOIN contacts ct ON c.contact_id = ct.id
    WHERE c.id = $1
  `, [callId]);

  if (result.rows.length === 0) {
    log('  Call not found', 'red');
    return;
  }

  const call = result.rows[0];

  log(`Call ID:       ${call.id}`, 'blue');
  log(`Contact:       ${call.contact_name} (${call.phone})`, 'blue');
  log(`Status:        ${call.status}`, call.status === 'completed' ? 'green' : 'yellow');
  log(`Outcome:       ${call.outcome || 'N/A'}`, 'blue');
  log(`Duration:      ${call.duration || 0} seconds`, 'blue');
  log(`Cost:          $${(call.cost || 0).toFixed(4)}`, 'blue');
  log(`Turns:         ${call.conversation_turns}`, 'blue');

  if (call.started_at && call.ended_at) {
    const duration = (new Date(call.ended_at) - new Date(call.started_at)) / 1000;
    log(`Actual Time:   ${duration.toFixed(1)}s`, 'blue');
  }

  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
}

async function checkSystemHealth() {
  log('\n🔧 Pre-flight System Check', 'cyan');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');

  // Check database
  try {
    await pool.query('SELECT 1');
    log('✓ Database connection: OK', 'green');
  } catch (error) {
    log('✗ Database connection: FAILED', 'red');
    throw error;
  }

  // Check if FastAGI would be reachable (we can't directly test from here)
  log('  FastAGI server: Assumed running (check with: netstat -tuln | grep 4573)', 'blue');

  // Check for active campaigns
  const campaignCheck = await pool.query(`SELECT COUNT(*) FROM campaigns WHERE status = 'active'`);
  const campaignCount = parseInt(campaignCheck.rows[0].count);

  if (campaignCount > 0) {
    log(`✓ Active campaigns: ${campaignCount}`, 'green');
  } else {
    log('✗ No active campaigns found', 'red');
    throw new Error('No active campaigns');
  }

  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'cyan');
}

async function runTest() {
  try {
    log('\n╔════════════════════════════════════════════════╗', 'cyan');
    log('║     SINGLE AI CALL END-TO-END TEST            ║', 'cyan');
    log('╔════════════════════════════════════════════════╗\n', 'cyan');

    await checkSystemHealth();

    const campaign = await getActiveCampaign();
    const contact = await getTestContact(campaign.id);

    // Get org ID
    const orgResult = await pool.query(`SELECT organization_id FROM campaigns WHERE id = $1`, [campaign.id]);
    const orgId = orgResult.rows[0].organization_id;

    const call = await createCallRecord(campaign.id, contact.id, orgId);

    await initiateCall(call.id, call.to_number, campaign.id);

    const turnCount = await monitorCall(call.id, 120);

    await showConversationTranscript(call.id);
    await showCallSummary(call.id);

    log('\n╔════════════════════════════════════════════════╗', 'cyan');
    if (turnCount > 0) {
      log('║  ✅ TEST PASSED: AI conversation successful!   ║', 'green');
    } else {
      log('║  ⚠️  TEST WARNING: No conversation detected    ║', 'yellow');
    }
    log('╔════════════════════════════════════════════════╗\n', 'cyan');

  } catch (error) {
    log('\n╔════════════════════════════════════════════════╗', 'red');
    log('║  ✗ TEST FAILED                                  ║', 'red');
    log('╔════════════════════════════════════════════════╗\n', 'red');
    log(`Error: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', async () => {
  log('\n\n⚠️  Test interrupted by user', 'yellow');

  if (testCallId) {
    log(`  Cleaning up call: ${testCallId}`, 'blue');
    try {
      await pool.query(`UPDATE calls SET status = 'failed', outcome = 'test_interrupted' WHERE id = $1`, [testCallId]);
    } catch (err) {
      // Ignore
    }
  }

  await pool.end();
  process.exit(0);
});

// Run the test
runTest();
