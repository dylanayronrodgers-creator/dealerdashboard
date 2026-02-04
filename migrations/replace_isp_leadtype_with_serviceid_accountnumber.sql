-- Migration: Replace ISP and Lead Type fields with Service ID and Account Number
-- Run this in your Supabase SQL Editor

-- Add new columns
ALTER TABLE leads ADD COLUMN IF NOT EXISTS service_id TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS account_number TEXT;

-- Optional: Copy data from old columns if you want to preserve any existing data
-- UPDATE leads SET service_id = isp WHERE isp IS NOT NULL;
-- UPDATE leads SET account_number = lead_type WHERE lead_type IS NOT NULL;

-- Drop old columns (uncomment when ready)
-- ALTER TABLE leads DROP COLUMN IF EXISTS isp;
-- ALTER TABLE leads DROP COLUMN IF EXISTS lead_type;

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_leads_service_id ON leads(service_id);
CREATE INDEX IF NOT EXISTS idx_leads_account_number ON leads(account_number);

-- Add comments
COMMENT ON COLUMN leads.service_id IS 'Service ID for the lead/order';
COMMENT ON COLUMN leads.account_number IS 'Account number for the client';
