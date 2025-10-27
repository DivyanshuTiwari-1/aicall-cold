-- Add missing priority column to contacts table
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 0;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_contacts_priority ON contacts(priority DESC);

-- Verify it was added
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'contacts' AND column_name = 'priority';
