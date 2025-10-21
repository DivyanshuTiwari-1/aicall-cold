const { query } = require('./config/database');

async function checkAgent() {
  try {
    const result = await query('SELECT id, email, first_name, last_name, sip_extension, sip_username, sip_password FROM users WHERE email = $1', ['salman@demo.com']);
    console.log('Agent data:', JSON.stringify(result.rows[0], null, 2));
  } catch (e) {
    console.error('Error:', e.message);
  }
  process.exit(0);
}

checkAgent();
