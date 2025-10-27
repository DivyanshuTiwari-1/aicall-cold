const {query} = require('./config/database');
(async () => {
  await query('ALTER TABLE phone_numbers ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true');
  await query('UPDATE phone_numbers SET is_active = true WHERE is_active IS NULL');
  console.log('✅ phone_numbers fixed');
  process.exit(0);
})();
