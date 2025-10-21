const { query } = require('./config/database');

async function updateAgentSip() {
  try {
    // Update the agent with SIP credentials
    await query(`
      UPDATE users 
      SET sip_extension = $1, sip_username = $2, sip_password = $3 
      WHERE email = $4
    `, ['6743', 'agent_6743', '8f4a2b1c9e7d3f6a5b8c2d1e4f7a9b3c6d', 'salman@demo.com']);
    
    console.log('✅ Agent SIP credentials updated successfully!');
    
    // Verify the update
    const result = await query('SELECT id, email, sip_extension, sip_username FROM users WHERE email = $1', ['salman@demo.com']);
    console.log('Updated agent data:', JSON.stringify(result.rows[0], null, 2));
    
  } catch (e) {
    console.error('Error updating agent:', e.message);
  }
  process.exit(0);
}

updateAgentSip();
