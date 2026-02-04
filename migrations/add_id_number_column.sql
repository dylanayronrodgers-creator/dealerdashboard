-- Migration: Add ID Number column to leads table
-- This stores the client's South African ID number as TEXT
-- Run this in your Supabase SQL Editor

-- Add the id_number column as TEXT (NOT UUID - SA ID numbers are 13-digit strings)
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS id_number TEXT;

-- If column exists as UUID, convert it to TEXT
-- ALTER TABLE leads ALTER COLUMN id_number TYPE TEXT;

-- Create an index for faster lookups (optional, but recommended)
CREATE INDEX IF NOT EXISTS idx_leads_id_number ON leads(id_number);

-- Add a comment to document the column purpose
COMMENT ON COLUMN leads.id_number IS 'Client South African ID number (13 digits)';
