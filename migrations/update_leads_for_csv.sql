-- =============================================
-- UPDATE LEADS TABLE FOR OPENSERVE CSV COMPATIBILITY
-- Run this in Supabase SQL Editor
-- =============================================

-- Add all columns needed for Openserve CSV import
-- Using IF NOT EXISTS pattern with DO blocks

DO $$ 
BEGIN
    -- lead_id - Unique identifier from CSV
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'lead_id') THEN
        ALTER TABLE leads ADD COLUMN lead_id TEXT UNIQUE;
    END IF;

    -- full_name - Primary contact name
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'full_name') THEN
        ALTER TABLE leads ADD COLUMN full_name TEXT;
    END IF;

    -- id_number - Client ID number
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'id_number') THEN
        ALTER TABLE leads ADD COLUMN id_number TEXT;
    END IF;

    -- isp - Internet Service Provider
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'isp') THEN
        ALTER TABLE leads ADD COLUMN isp TEXT DEFAULT 'Openserve';
    END IF;

    -- lead_type - Type of lead
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'lead_type') THEN
        ALTER TABLE leads ADD COLUMN lead_type TEXT;
    END IF;

    -- dealer_id - Reference to dealers table
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'dealer_id') THEN
        ALTER TABLE leads ADD COLUMN dealer_id UUID REFERENCES dealers(id) ON DELETE SET NULL;
    END IF;

    -- Secondary contact fields
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'secondary_contact_name') THEN
        ALTER TABLE leads ADD COLUMN secondary_contact_name TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'secondary_contact_number') THEN
        ALTER TABLE leads ADD COLUMN secondary_contact_number TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'secondary_contact_email') THEN
        ALTER TABLE leads ADD COLUMN secondary_contact_email TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'secondary_contact') THEN
        ALTER TABLE leads ADD COLUMN secondary_contact TEXT;
    END IF;

    -- Order tracking fields
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'order_number') THEN
        ALTER TABLE leads ADD COLUMN order_number TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'order_status') THEN
        ALTER TABLE leads ADD COLUMN order_status TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'order_date') THEN
        ALTER TABLE leads ADD COLUMN order_date TIMESTAMPTZ;
    END IF;

    -- Tracking fields
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'date_captured') THEN
        ALTER TABLE leads ADD COLUMN date_captured TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'last_updated') THEN
        ALTER TABLE leads ADD COLUMN last_updated TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'captured_by_email') THEN
        ALTER TABLE leads ADD COLUMN captured_by_email TEXT;
    END IF;

    -- Commission fields
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'commission_status') THEN
        ALTER TABLE leads ADD COLUMN commission_status TEXT DEFAULT 'pending' CHECK (commission_status IN ('pending', 'confirmed', 'rejected', 'paid'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'commission_amount') THEN
        ALTER TABLE leads ADD COLUMN commission_amount DECIMAL(10,2);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'confirmed_at') THEN
        ALTER TABLE leads ADD COLUMN confirmed_at TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'rejected_at') THEN
        ALTER TABLE leads ADD COLUMN rejected_at TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'rejection_reason') THEN
        ALTER TABLE leads ADD COLUMN rejection_reason TEXT;
    END IF;
END $$;

-- Create index on lead_id for faster duplicate checking
CREATE INDEX IF NOT EXISTS idx_leads_lead_id ON leads(lead_id);
CREATE INDEX IF NOT EXISTS idx_leads_dealer_id ON leads(dealer_id);
CREATE INDEX IF NOT EXISTS idx_leads_order_number ON leads(order_number);

-- Make first_name and last_name nullable (full_name is preferred)
ALTER TABLE leads ALTER COLUMN first_name DROP NOT NULL;
ALTER TABLE leads ALTER COLUMN last_name DROP NOT NULL;
ALTER TABLE leads ALTER COLUMN email DROP NOT NULL;
ALTER TABLE leads ALTER COLUMN phone DROP NOT NULL;

-- Update status check constraint to include more statuses
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_status_check;
ALTER TABLE leads ADD CONSTRAINT leads_status_check 
    CHECK (status IN ('new', 'contacted', 'qualified', 'converted', 'lost', 'returned', 'pending', 'processing', 'completed', 'cancelled'));

-- Done!
-- CSV columns now supported:
-- LEAD ID, AGENT, DEALER, DEAL, ISP, LEAD TYPE, STATUS, REGION,
-- PRIMARY CONTACT NAME, PRIMARY CONTACT NUMBER, PRIMARY CONTACT EMAIL,
-- SECONDARY CONTACT NAME, SECONDARY CONTACT NUMBER, SECONDARY CONTACT EMAIL,
-- ORDER NUMBER, ORDER STATUS, ORDER DATE, DATE CAPTURED, LAST UPDATED, CAPTURED BY
