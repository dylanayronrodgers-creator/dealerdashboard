-- Add Service ID, Order Number, and ensure Lead ID visibility
-- Run this in Supabase SQL Editor

-- Add service_id column if it doesn't exist (Internal ID from Openserve)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'service_id') THEN
        ALTER TABLE leads ADD COLUMN service_id TEXT;
    END IF;
END $$;

-- Add order_number column if it doesn't exist (Universal Order Number)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'order_number') THEN
        ALTER TABLE leads ADD COLUMN order_number TEXT;
    END IF;
END $$;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_leads_order_number ON leads(order_number);
CREATE INDEX IF NOT EXISTS idx_leads_service_id ON leads(service_id);

-- Add return_direction to leads table for hierarchy flow
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'return_direction') THEN
        ALTER TABLE leads ADD COLUMN return_direction TEXT CHECK (return_direction IN ('to_openserve', 'to_admin', 'to_agent'));
    END IF;
END $$;

-- Add return_resolved to leads table
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'return_resolved') THEN
        ALTER TABLE leads ADD COLUMN return_resolved TEXT CHECK (return_resolved IN ('pending', 'acknowledged', 'resolved', 'rejected', 'forwarded'));
    END IF;
END $$;

-- Add resolution_notes to leads table
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'resolution_notes') THEN
        ALTER TABLE leads ADD COLUMN resolution_notes TEXT;
    END IF;
END $$;

-- Update returned_items table to support hierarchy flow
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'returned_items' AND column_name = 'return_direction') THEN
        ALTER TABLE returned_items ADD COLUMN return_direction TEXT DEFAULT 'to_admin' 
            CHECK (return_direction IN ('to_openserve', 'to_admin', 'to_agent'));
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'returned_items' AND column_name = 'target_user_id') THEN
        ALTER TABLE returned_items ADD COLUMN target_user_id UUID REFERENCES profiles(id);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'returned_items' AND column_name = 'source_role') THEN
        ALTER TABLE returned_items ADD COLUMN source_role TEXT;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'returned_items' AND column_name = 'target_role') THEN
        ALTER TABLE returned_items ADD COLUMN target_role TEXT;
    END IF;
END $$;
