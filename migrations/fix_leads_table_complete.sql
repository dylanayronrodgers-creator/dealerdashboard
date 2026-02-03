-- Complete leads table fix - Run this in Supabase SQL Editor
-- This adds all columns needed for CSV import

-- First ensure RLS is properly configured
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "leads_select_policy" ON leads;
DROP POLICY IF EXISTS "leads_insert_policy" ON leads;
DROP POLICY IF EXISTS "leads_update_policy" ON leads;
DROP POLICY IF EXISTS "leads_delete_policy" ON leads;
DROP POLICY IF EXISTS "Enable read access for all users" ON leads;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON leads;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON leads;

-- Create permissive policies for authenticated users
CREATE POLICY "leads_select_policy" ON leads FOR SELECT TO authenticated USING (true);
CREATE POLICY "leads_insert_policy" ON leads FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "leads_update_policy" ON leads FOR UPDATE TO authenticated USING (true);
CREATE POLICY "leads_delete_policy" ON leads FOR DELETE TO authenticated USING (true);

-- Also allow anon access for testing
CREATE POLICY "leads_anon_select" ON leads FOR SELECT TO anon USING (true);
CREATE POLICY "leads_anon_insert" ON leads FOR INSERT TO anon WITH CHECK (true);

-- First, add the lead_id column if it doesn't exist
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lead_id TEXT;

-- Basic contact info columns
ALTER TABLE leads ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS address TEXT;

-- Agent and dealer name columns (for display when not linked)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS agent_name TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS dealer_name TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS package_name TEXT;

-- Import metadata columns
ALTER TABLE leads ADD COLUMN IF NOT EXISTS captured_by_email TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lead_type TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS isp TEXT;

-- Order related columns
ALTER TABLE leads ADD COLUMN IF NOT EXISTS order_number TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS order_status TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS order_date TIMESTAMPTZ;

-- Date columns
ALTER TABLE leads ADD COLUMN IF NOT EXISTS date_captured TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_updated TIMESTAMPTZ;

-- Secondary contact columns
ALTER TABLE leads ADD COLUMN IF NOT EXISTS secondary_contact_name TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS secondary_contact_number TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS secondary_contact_email TEXT;

-- Commission columns
ALTER TABLE leads ADD COLUMN IF NOT EXISTS commission_amount NUMERIC DEFAULT 0;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS commission_status TEXT DEFAULT 'none';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Create index on lead_id for faster duplicate checking
CREATE INDEX IF NOT EXISTS idx_leads_lead_id ON leads(lead_id);

-- Grant permissions
GRANT ALL ON leads TO authenticated;
GRANT ALL ON leads TO anon;
