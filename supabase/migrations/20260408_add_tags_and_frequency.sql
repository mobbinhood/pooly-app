-- Add customer tagging and recurring service frequency
ALTER TABLE customers ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS service_frequency text DEFAULT 'weekly';

-- Index for tag-based filtering
CREATE INDEX IF NOT EXISTS idx_customers_tags ON customers USING GIN (tags);
