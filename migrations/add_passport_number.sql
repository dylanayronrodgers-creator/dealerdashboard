-- Add passport_number column to leads table
-- Run this in Supabase SQL Editor

ALTER TABLE leads ADD COLUMN IF NOT EXISTS passport_number TEXT;

-- Add comment for documentation
COMMENT ON COLUMN leads.passport_number IS 'Passport number for foreign nationals (alternative to SA ID)';
