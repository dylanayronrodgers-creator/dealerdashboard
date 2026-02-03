-- =============================================
-- LEADS TABLE WITH EXACT CSV COLUMN NAMES
-- For direct Supabase CSV import
-- =============================================

-- Option 1: Rename existing columns (if table exists with data)
-- Run this if you want to keep existing data

DO $$ 
BEGIN
    -- Rename columns to match CSV headers exactly
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'lead_id') THEN
        ALTER TABLE leads RENAME COLUMN lead_id TO "LEAD ID";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'isp') THEN
        ALTER TABLE leads RENAME COLUMN isp TO "ISP";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'lead_type') THEN
        ALTER TABLE leads RENAME COLUMN lead_type TO "LEAD TYPE";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'status') THEN
        ALTER TABLE leads RENAME COLUMN status TO "STATUS";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'address') THEN
        ALTER TABLE leads RENAME COLUMN address TO "REGION";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'full_name') THEN
        ALTER TABLE leads RENAME COLUMN full_name TO "PRIMARY CONTACT NAME";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'phone') THEN
        ALTER TABLE leads RENAME COLUMN phone TO "PRIMARY CONTACT NUMBER";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'email') THEN
        ALTER TABLE leads RENAME COLUMN email TO "PRIMARY CONTACT EMAIL";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'secondary_contact_name') THEN
        ALTER TABLE leads RENAME COLUMN secondary_contact_name TO "SECONDARY CONTACT NAME";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'secondary_contact_number') THEN
        ALTER TABLE leads RENAME COLUMN secondary_contact_number TO "SECONDARY CONTACT NUMBER";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'secondary_contact_email') THEN
        ALTER TABLE leads RENAME COLUMN secondary_contact_email TO "SECONDARY CONTACT EMAIL";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'secondary_contact') THEN
        ALTER TABLE leads RENAME COLUMN secondary_contact TO "SECONDARY CONTACT";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'order_number') THEN
        ALTER TABLE leads RENAME COLUMN order_number TO "ORDER NUMBER";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'order_status') THEN
        ALTER TABLE leads RENAME COLUMN order_status TO "ORDER STATUS";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'order_date') THEN
        ALTER TABLE leads RENAME COLUMN order_date TO "ORDER DATE";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'date_captured') THEN
        ALTER TABLE leads RENAME COLUMN date_captured TO "DATE CAPTURED";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'last_updated') THEN
        ALTER TABLE leads RENAME COLUMN last_updated TO "LAST UPDATED";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'captured_by_email') THEN
        ALTER TABLE leads RENAME COLUMN captured_by_email TO "CAPTURED BY";
    END IF;
END $$;

-- Add missing columns with exact CSV names
ALTER TABLE leads ADD COLUMN IF NOT EXISTS "LEAD ID" TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS "AGENT" TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS "DEALER" TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS "DEAL" TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS "ISP" TEXT DEFAULT 'Openserve';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS "LEAD TYPE" TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS "STATUS" TEXT DEFAULT 'new';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS "REGION" TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS "PRIMARY CONTACT NAME" TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS "PRIMARY CONTACT NUMBER" TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS "PRIMARY CONTACT EMAIL" TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS "SECONDARY CONTACT NAME" TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS "SECONDARY CONTACT NUMBER" TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS "SECONDARY CONTACT SECONDARY" TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS "SECONDARY CONTACT EMAIL" TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS "ORDER NUMBER" TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS "ORDER STATUS" TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS "ORDER DATE" TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS "DATE CAPTURED" TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS "LAST UPDATED" TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS "CAPTURED BY" TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS "SECONDARY CONTACT" TEXT;

-- Create unique index on LEAD ID
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_lead_id ON leads("LEAD ID");

-- Done! Table now accepts direct CSV import from Supabase
