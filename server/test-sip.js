const { query } = require('./config/database');

async function checkSip() {
  try {
    const result = await query('SELECT sip_extension, sip_username FROM users WHERE email = $1', ['salman@demo.com']);
    console.log('Agent SIP credentials:', JSON.stringify(result.rows[0], null, 2));
  } catch (e) {
    console.error('Error:', e.message);
  }
  process.exit(0);
}

checkSip();
