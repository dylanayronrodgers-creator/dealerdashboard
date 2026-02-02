-- Migration: Add ID Number column to leads table
-- This stores the client's ID number as a UUID for security
-- Run this in your Supabase SQL Editor

-- Add the id_number column as UUID
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS id_number UUID;

-- Create an index for faster lookups (optional, but recommended)
CREATE INDEX IF NOT EXISTS idx_leads_id_number ON leads(id_number);

-- Add a comment to document the column purpose
COMMENT ON COLUMN leads.id_number IS 'Client ID number stored as UUID for security purposes';
