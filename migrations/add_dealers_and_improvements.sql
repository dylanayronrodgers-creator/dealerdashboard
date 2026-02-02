-- Migration: Add Dealers, Improve Lead Import, Agent Approval System
-- Run this in Supabase SQL Editor

-- ============================================
-- 1. DEALERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS dealers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    code TEXT UNIQUE,  -- Short code for the dealer
    contact_email TEXT,
    contact_phone TEXT,
    address TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on dealers
ALTER TABLE dealers ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first
DROP POLICY IF EXISTS "Anyone can view active dealers" ON dealers;
DROP POLICY IF EXISTS "Admins can manage dealers" ON dealers;

-- Dealers policies
CREATE POLICY "Anyone can view active dealers" ON dealers
    FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage dealers" ON dealers
    FOR ALL USING (public.is_admin());

-- ============================================
-- 2. PENDING AGENTS TABLE (for approval workflow)
-- ============================================
CREATE TABLE IF NOT EXISTS pending_agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    phone TEXT,
    dealer_id UUID REFERENCES dealers(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on pending_agents
ALTER TABLE pending_agents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage pending agents" ON pending_agents;
CREATE POLICY "Admins can manage pending agents" ON pending_agents
    FOR ALL USING (public.is_admin());

-- ============================================
-- 3. SYSTEM SETTINGS TABLE (for Openserve API toggle)
-- ============================================
CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES profiles(id)
);

-- Enable RLS on system_settings
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view settings" ON system_settings;
DROP POLICY IF EXISTS "Admins can manage settings" ON system_settings;

CREATE POLICY "Anyone can view settings" ON system_settings
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage settings" ON system_settings
    FOR ALL USING (public.is_admin());

-- Insert default settings
INSERT INTO system_settings (key, value) VALUES
    ('openserve_api_enabled', '{"enabled": false}'::jsonb),
    ('openserve_api_config', '{"api_url": "", "api_key": ""}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- 4. UPDATE PROFILES TABLE
-- ============================================
-- Add dealer_id to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS dealer_id UUID REFERENCES dealers(id) ON DELETE SET NULL;

-- Add approval status for imported agents
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT true;

-- ============================================
-- 5. UPDATE LEADS TABLE
-- ============================================
-- Add lead_id (external reference from CSV)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lead_id TEXT UNIQUE;

-- Add full_name and id_number fields
ALTER TABLE leads ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS id_number TEXT;

-- Add dealer_id to leads
ALTER TABLE leads ADD COLUMN IF NOT EXISTS dealer_id UUID REFERENCES dealers(id) ON DELETE SET NULL;

-- Add captured_by_email (original agent email from import)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS captured_by_email TEXT;

-- Add order tracking fields from CSV
ALTER TABLE leads ADD COLUMN IF NOT EXISTS order_number TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS order_status TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS order_date TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS date_captured TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_updated TIMESTAMPTZ;

-- Add secondary contact fields
ALTER TABLE leads ADD COLUMN IF NOT EXISTS secondary_contact_name TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS secondary_contact_number TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS secondary_contact_email TEXT;

-- Add lead type and ISP fields
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lead_type TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS isp TEXT;

-- Create index on lead_id for duplicate detection
CREATE INDEX IF NOT EXISTS idx_leads_lead_id ON leads(lead_id);
CREATE INDEX IF NOT EXISTS idx_leads_dealer_id ON leads(dealer_id);
CREATE INDEX IF NOT EXISTS idx_profiles_dealer_id ON profiles(dealer_id);

-- ============================================
-- 6. PACKAGE NAME ALIASES (for intelligent matching)
-- ============================================
CREATE TABLE IF NOT EXISTS package_aliases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    package_id UUID REFERENCES packages(id) ON DELETE CASCADE,
    alias TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE package_aliases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view package aliases" ON package_aliases;
DROP POLICY IF EXISTS "Admins can manage package aliases" ON package_aliases;

CREATE POLICY "Anyone can view package aliases" ON package_aliases
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage package aliases" ON package_aliases
    FOR ALL USING (public.is_admin());

-- Insert common aliases
INSERT INTO packages (name, speed, price, description) VALUES
    ('Webconnect 20/10Mbps', 20, 399.00, '20Mbps down / 10Mbps up uncapped fibre'),
    ('Webconnect 50/25Mbps', 50, 599.00, '50Mbps down / 25Mbps up uncapped fibre'),
    ('Webconnect 100/50Mbps', 100, 799.00, '100Mbps down / 50Mbps up uncapped fibre'),
    ('Webconnect 200/100Mbps', 200, 999.00, '200Mbps down / 100Mbps up uncapped fibre'),
    ('Webconnect 500/250Mbps', 500, 1299.00, '500Mbps down / 250Mbps up uncapped fibre')
ON CONFLICT DO NOTHING;

-- Add aliases for package matching
INSERT INTO package_aliases (package_id, alias)
SELECT id, '20/10Mbps Uncapped Fibre' FROM packages WHERE name = 'Webconnect 20/10Mbps'
ON CONFLICT DO NOTHING;

INSERT INTO package_aliases (package_id, alias)
SELECT id, '50/25 Mbps Uncapped Fibre' FROM packages WHERE name = 'Webconnect 50/25Mbps'
ON CONFLICT DO NOTHING;

INSERT INTO package_aliases (package_id, alias)
SELECT id, '200/100 Uncapped Fibre' FROM packages WHERE name = 'Webconnect 200/100Mbps'
ON CONFLICT DO NOTHING;

-- ============================================
-- 7. FUNCTION TO MATCH PACKAGE BY NAME OR ALIAS
-- ============================================
CREATE OR REPLACE FUNCTION public.find_package_id(package_name TEXT)
RETURNS UUID AS $$
DECLARE
    found_id UUID;
BEGIN
    -- First try exact match on package name
    SELECT id INTO found_id FROM packages WHERE LOWER(name) = LOWER(package_name) LIMIT 1;
    IF found_id IS NOT NULL THEN
        RETURN found_id;
    END IF;
    
    -- Try alias match
    SELECT package_id INTO found_id FROM package_aliases WHERE LOWER(alias) = LOWER(package_name) LIMIT 1;
    IF found_id IS NOT NULL THEN
        RETURN found_id;
    END IF;
    
    -- Try partial match on package name
    SELECT id INTO found_id FROM packages WHERE LOWER(name) LIKE '%' || LOWER(package_name) || '%' LIMIT 1;
    IF found_id IS NOT NULL THEN
        RETURN found_id;
    END IF;
    
    -- Try to extract speed and match
    SELECT id INTO found_id FROM packages 
    WHERE package_name ~* (speed::TEXT || '.*mbps|' || speed::TEXT || '/') 
    ORDER BY speed DESC LIMIT 1;
    
    RETURN found_id;
END;
$$ LANGUAGE plpgsql STABLE;
