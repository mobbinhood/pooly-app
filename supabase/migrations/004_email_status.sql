-- Add email tracking columns to service_logs
ALTER TABLE service_logs
  ADD COLUMN IF NOT EXISTS email_status TEXT CHECK (email_status IN ('pending', 'sent', 'failed')),
  ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ;
