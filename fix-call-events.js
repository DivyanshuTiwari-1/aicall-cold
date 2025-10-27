const {query} = require('./config/database');
(async () => {
  console.log('Fixing call_events table...');

  // Check current structure
  const columns = await query(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'call_events'
    ORDER BY ordinal_position
  `);

  console.log('Current columns:', columns.rows.map(r => r.column_name).join(', '));

  // Add missing columns
  await query(`
    ALTER TABLE call_events
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  `);

  console.log('✅ call_events table fixed');

  // Check if we have users
  const users = await query(`SELECT email FROM users LIMIT 3`);
  console.log('\nAvailable users:', users.rows.map(u => u.email).join(', '));

  process.exit(0);
})();
