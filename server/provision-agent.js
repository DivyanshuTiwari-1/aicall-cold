const { query } = require('./config/database');
const sipProvisioning = require('./services/sip-provisioning');

async function provisionAgent() {
  try {
    // Get the agent
    const agentResult = await query('SELECT id, email, first_name, last_name FROM users WHERE email = $1', ['salman@demo.com']);
    const agent = agentResult.rows[0];
    
    if (!agent) {
      console.error('Agent not found');
      return;
    }
    
    console.log('Found agent:', agent.email);
    
    // Generate SIP credentials
    const sipExtension = sipProvisioning.generateSipExtension(agent.id);
    const sipPassword = sipProvisioning.generateSipCredentials();
    const sipUsername = sipProvisioning.generateSipUsername(sipExtension);
    
    console.log('Generated SIP credentials:', { sipExtension, sipUsername });
    
    // Provision the endpoint in Asterisk
    await sipProvisioning.provisionAgentEndpoint(agent.id, sipExtension, sipUsername, sipPassword);
    
    // Update the database
    await query(`
      UPDATE users 
      SET sip_extension = $1, sip_username = $2, sip_password = $3 
      WHERE id = $4
    `, [sipExtension, sipUsername, sipPassword, agent.id]);
    
    console.log('✅ SIP credentials provisioned successfully!');
    console.log('Extension:', sipExtension);
    console.log('Username:', sipUsername);
    console.log('Password:', sipPassword);
    
  } catch (e) {
    console.error('Error provisioning agent:', e.message);
  }
  process.exit(0);
}

provisionAgent();
