const {query} = require('./config/database');
(async () => {
  console.log('Adding automated column to calls table...');
  await query('ALTER TABLE calls ADD COLUMN IF NOT EXISTS automated BOOLEAN DEFAULT false');
  await query('CREATE INDEX IF NOT EXISTS idx_calls_automated ON calls(automated, status, created_at DESC)');
  console.log('✅ calls.automated column added');
  process.exit(0);
})();
