-- Complete Supabase Schema for Axxess Dealer Portal
-- Run this in the Supabase SQL Editor to set up all tables, policies, and functions
-- Version: 2.0

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================
-- PROFILES TABLE
-- =====================
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    role TEXT DEFAULT 'agent' CHECK (role IN ('admin', 'dealer', 'agent', 'openserve', 'external_agent')),
    phone TEXT,
    dealer_id UUID,
    is_active BOOLEAN DEFAULT true,
    is_approved BOOLEAN DEFAULT false,
    avatar_url TEXT,
    avatar_seed TEXT,
    team_type TEXT DEFAULT 'dealer_agent' CHECK (team_type IN ('dealer_agent', 'internal')),
    commission_rate DECIMAL(5,2) DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- DEALERS TABLE
-- =====================
CREATE TABLE IF NOT EXISTS dealers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    code TEXT UNIQUE,
    contact_email TEXT,
    contact_phone TEXT,
    address TEXT,
    logo_url TEXT,
    commission_rate DECIMAL(5,2) DEFAULT 10.00,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add foreign key for dealer_id in profiles
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS fk_profiles_dealer;
ALTER TABLE profiles 
ADD CONSTRAINT fk_profiles_dealer 
FOREIGN KEY (dealer_id) REFERENCES dealers(id) ON DELETE SET NULL;

-- =====================
-- PACKAGES TABLE
-- =====================
CREATE TABLE IF NOT EXISTS packages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL DEFAULT 0,
    speed TEXT,
    data_cap TEXT,
    contract_term INTEGER DEFAULT 24,
    provider TEXT DEFAULT 'Openserve',
    is_active BOOLEAN DEFAULT true,
    commission_amount DECIMAL(10,2) DEFAULT 0,
    product_type TEXT DEFAULT 'fibre' CHECK (product_type IN ('fibre', 'prepaid')),
    dealer_commission DECIMAL(10,2) DEFAULT 200.00,
    agent_commission DECIMAL(10,2) DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- PACKAGE ALIASES TABLE
-- =====================
CREATE TABLE IF NOT EXISTS package_aliases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    package_id UUID REFERENCES packages(id) ON DELETE CASCADE,
    alias TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- LEADS TABLE
-- =====================
CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Client Information
    first_name TEXT,
    last_name TEXT,
    full_name TEXT,
    email TEXT,
    phone TEXT,
    alt_phone TEXT,
    cell_number TEXT,
    id_number TEXT,
    passport_number TEXT,
    
    -- Address Information
    address TEXT,
    suburb TEXT,
    city TEXT,
    province TEXT,
    postal_code TEXT,
    complex_name TEXT,
    unit_number TEXT,
    
    -- Order Tracking
    service_id TEXT,
    order_number TEXT,
    lead_id TEXT,
    
    -- Lead Details
    agent_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    dealer_id UUID REFERENCES dealers(id) ON DELETE SET NULL,
    package_id UUID REFERENCES packages(id) ON DELETE SET NULL,
    source TEXT DEFAULT 'direct',
    lead_type TEXT,
    isp TEXT,
    
    -- Status Fields
    status TEXT DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'converted', 'lost')),
    order_status TEXT CHECK (order_status IN ('pending', 'processing', 'scheduled', 'in_progress', 'completed', 'cancelled', 'returned')),
    commission_status TEXT DEFAULT 'pending' CHECK (commission_status IN ('pending', 'confirmed', 'paid', 'rejected')),
    
    -- Commission
    commission_amount DECIMAL(10,2) DEFAULT 0,
    package_price DECIMAL(10,2) DEFAULT 0,
    
    -- Scheduling
    scheduled_date TIMESTAMPTZ,
    installation_date TIMESTAMPTZ,
    order_date TIMESTAMPTZ,
    
    -- Return Information
    return_reason TEXT,
    returned_by UUID REFERENCES profiles(id),
    returned_at TIMESTAMPTZ,
    return_resolved TEXT CHECK (return_resolved IN ('pending', 'acknowledged', 'resolved', 'rejected', 'forwarded')),
    return_direction TEXT CHECK (return_direction IN ('to_openserve', 'to_admin', 'to_agent')),
    resolution_notes TEXT,
    
    -- Secondary Contact
    secondary_contact_name TEXT,
    secondary_contact_number TEXT,
    secondary_contact_email TEXT,
    
    -- Notes
    notes TEXT,
    agent_notes TEXT,
    admin_notes TEXT,
    openserve_notes TEXT,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    converted_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    confirmed_at TIMESTAMPTZ,
    rejected_at TIMESTAMPTZ,
    rejection_reason TEXT
);

-- =====================
-- ORDERS TABLE
-- =====================
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    package_id UUID REFERENCES packages(id),
    agent_id UUID REFERENCES profiles(id),
    dealer_id UUID REFERENCES dealers(id),
    order_number TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'scheduled', 'completed', 'cancelled')),
    notes TEXT,
    commission_amount DECIMAL(10,2) DEFAULT 0,
    commission_status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- RETURNED ITEMS TABLE
-- =====================
CREATE TABLE IF NOT EXISTS returned_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    returned_by UUID REFERENCES profiles(id),
    reason TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'acknowledged', 'resolved', 'rejected')),
    resolution_notes TEXT,
    resolved_by UUID REFERENCES profiles(id),
    resolved_at TIMESTAMPTZ,
    return_direction TEXT DEFAULT 'to_admin' CHECK (return_direction IN ('to_openserve', 'to_admin', 'to_agent')),
    target_user_id UUID REFERENCES profiles(id),
    source_role TEXT,
    target_role TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- PENDING AGENTS TABLE
-- =====================
CREATE TABLE IF NOT EXISTS pending_agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT NOT NULL,
    full_name TEXT NOT NULL,
    phone TEXT,
    dealer_id UUID REFERENCES dealers(id),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- NOTIFICATIONS TABLE
-- =====================
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT,
    type TEXT DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error')),
    is_read BOOLEAN DEFAULT false,
    link TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- SYSTEM SETTINGS TABLE
-- =====================
CREATE TABLE IF NOT EXISTS system_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key TEXT UNIQUE NOT NULL,
    value JSONB,
    description TEXT,
    updated_by UUID REFERENCES profiles(id),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- ADMIN SETTINGS TABLE
-- =====================
CREATE TABLE IF NOT EXISTS admin_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key TEXT UNIQUE NOT NULL,
    value JSONB,
    description TEXT,
    updated_by UUID REFERENCES profiles(id),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- USER PRIVILEGES TABLE
-- =====================
CREATE TABLE IF NOT EXISTS user_privileges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    privilege TEXT NOT NULL,
    granted_by UUID REFERENCES profiles(id),
    granted_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, privilege)
);

-- =====================
-- AUDIT LOG TABLE
-- =====================
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id),
    action TEXT NOT NULL,
    table_name TEXT,
    record_id UUID,
    old_data JSONB,
    new_data JSONB,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- INDEXES
-- =====================
CREATE INDEX IF NOT EXISTS idx_leads_agent_id ON leads(agent_id);
CREATE INDEX IF NOT EXISTS idx_leads_dealer_id ON leads(dealer_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_order_status ON leads(order_status);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_lead_id ON leads(lead_id);
CREATE INDEX IF NOT EXISTS idx_profiles_dealer_id ON profiles(dealer_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_orders_lead_id ON orders(lead_id);
CREATE INDEX IF NOT EXISTS idx_orders_agent_id ON orders(agent_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_returned_items_lead_id ON returned_items(lead_id);
CREATE INDEX IF NOT EXISTS idx_pending_agents_dealer_id ON pending_agents(dealer_id);
CREATE INDEX IF NOT EXISTS idx_pending_agents_status ON pending_agents(status);

-- =====================
-- ROW LEVEL SECURITY
-- =====================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE dealers ENABLE ROW LEVEL SECURITY;
ALTER TABLE packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE returned_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_privileges ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE package_aliases ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON profiles;
DROP POLICY IF EXISTS "Dealers are viewable by everyone" ON dealers;
DROP POLICY IF EXISTS "Only admins can modify dealers" ON dealers;
DROP POLICY IF EXISTS "Packages are viewable by everyone" ON packages;
DROP POLICY IF EXISTS "Only admins can modify packages" ON packages;
DROP POLICY IF EXISTS "Leads are viewable by related users" ON leads;
DROP POLICY IF EXISTS "Agents can insert leads" ON leads;
DROP POLICY IF EXISTS "Users can update accessible leads" ON leads;
DROP POLICY IF EXISTS "Orders are viewable by related users" ON orders;
DROP POLICY IF EXISTS "Users can modify accessible orders" ON orders;

-- Profiles Policies
CREATE POLICY "Public profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can update any profile" ON profiles FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Dealers Policies
CREATE POLICY "Dealers are viewable by everyone" ON dealers FOR SELECT USING (true);
CREATE POLICY "Only admins can modify dealers" ON dealers FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Packages Policies
CREATE POLICY "Packages are viewable by everyone" ON packages FOR SELECT USING (true);
CREATE POLICY "Only admins can modify packages" ON packages FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Leads Policies
CREATE POLICY "Leads are viewable by related users" ON leads FOR SELECT USING (
    auth.uid() = agent_id OR
    auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin') OR
    auth.uid() IN (SELECT id FROM profiles WHERE role = 'openserve') OR
    dealer_id IN (SELECT dealer_id FROM profiles WHERE id = auth.uid())
);
CREATE POLICY "Agents can insert leads" ON leads FOR INSERT WITH CHECK (
    auth.uid() = agent_id OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'agent', 'openserve'))
);
CREATE POLICY "Users can update accessible leads" ON leads FOR UPDATE USING (
    auth.uid() = agent_id OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'openserve'))
);

-- Orders Policies
CREATE POLICY "Orders are viewable by related users" ON orders FOR SELECT USING (
    auth.uid() = agent_id OR
    auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin') OR
    auth.uid() IN (SELECT id FROM profiles WHERE role = 'openserve') OR
    dealer_id IN (SELECT dealer_id FROM profiles WHERE id = auth.uid())
);
CREATE POLICY "Users can modify accessible orders" ON orders FOR ALL USING (
    auth.uid() = agent_id OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'openserve'))
);

-- =====================
-- FUNCTIONS & TRIGGERS
-- =====================

-- Update timestamp function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop existing triggers
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
DROP TRIGGER IF EXISTS update_dealers_updated_at ON dealers;
DROP TRIGGER IF EXISTS update_packages_updated_at ON packages;
DROP TRIGGER IF EXISTS update_leads_updated_at ON leads;
DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
DROP TRIGGER IF EXISTS update_returned_items_updated_at ON returned_items;
DROP TRIGGER IF EXISTS update_pending_agents_updated_at ON pending_agents;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Apply triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_dealers_updated_at BEFORE UPDATE ON dealers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_packages_updated_at BEFORE UPDATE ON packages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_returned_items_updated_at BEFORE UPDATE ON returned_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_pending_agents_updated_at BEFORE UPDATE ON pending_agents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'role', 'agent')
    );
    RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================
-- HELPER FUNCTIONS
-- =====================

-- Confirm lead function
CREATE OR REPLACE FUNCTION confirm_lead(p_lead_id UUID)
RETURNS void AS $$
DECLARE
    pkg_commission DECIMAL(10,2);
BEGIN
    SELECT COALESCE(p.dealer_commission, 200.00) INTO pkg_commission
    FROM leads l LEFT JOIN packages p ON l.package_id = p.id
    WHERE l.id = p_lead_id;
    
    UPDATE leads SET
        commission_status = 'confirmed',
        commission_amount = pkg_commission,
        confirmed_at = NOW(),
        status = 'converted'
    WHERE id = p_lead_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reject lead function
CREATE OR REPLACE FUNCTION reject_lead(p_lead_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS void AS $$
BEGIN
    UPDATE leads SET
        commission_status = 'rejected',
        rejected_at = NOW(),
        rejection_reason = p_reason,
        status = 'lost'
    WHERE id = p_lead_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================
-- VIEWS
-- =====================

-- Dealer Revenue Summary
CREATE OR REPLACE VIEW dealer_revenue_summary AS
SELECT 
    d.id as dealer_id,
    d.name as dealer_name,
    COUNT(CASE WHEN l.commission_status IN ('confirmed', 'paid') THEN 1 END) as confirmed_count,
    COUNT(CASE WHEN l.commission_status = 'pending' THEN 1 END) as pending_count,
    COUNT(CASE WHEN l.commission_status = 'rejected' THEN 1 END) as rejected_count,
    COUNT(l.id) as total_leads,
    COALESCE(SUM(CASE WHEN l.commission_status IN ('confirmed', 'paid') THEN COALESCE(l.commission_amount, p.dealer_commission, 200) ELSE 0 END), 0) as confirmed_revenue,
    COALESCE(SUM(CASE WHEN l.commission_status = 'pending' THEN COALESCE(p.dealer_commission, 200) ELSE 0 END), 0) as pending_revenue
FROM dealers d
LEFT JOIN leads l ON l.dealer_id = d.id
LEFT JOIN packages p ON l.package_id = p.id
WHERE d.is_active = true
GROUP BY d.id, d.name;

-- Agent Performance Summary
CREATE OR REPLACE VIEW agent_performance_summary AS
SELECT 
    pr.id as agent_id,
    pr.full_name as agent_name,
    pr.dealer_id,
    d.name as dealer_name,
    pr.team_type,
    COUNT(CASE WHEN l.commission_status IN ('confirmed', 'paid') THEN 1 END) as confirmed_count,
    COUNT(CASE WHEN l.commission_status = 'pending' THEN 1 END) as pending_count,
    COUNT(l.id) as total_leads
FROM profiles pr
LEFT JOIN leads l ON l.agent_id = pr.id
LEFT JOIN dealers d ON pr.dealer_id = d.id
WHERE pr.role = 'agent'
GROUP BY pr.id, pr.full_name, pr.dealer_id, d.name, pr.team_type;

-- Dashboard Stats View
CREATE OR REPLACE VIEW dashboard_stats AS
SELECT
    (SELECT COUNT(*) FROM leads WHERE status != 'converted') as total_leads,
    (SELECT COUNT(*) FROM leads WHERE commission_status = 'pending') as pending_leads,
    (SELECT COUNT(*) FROM leads WHERE commission_status IN ('confirmed', 'paid')) as confirmed_leads,
    (SELECT COUNT(*) FROM leads WHERE commission_status = 'rejected') as rejected_leads,
    (SELECT COUNT(*) FROM orders WHERE status NOT IN ('completed', 'cancelled')) as active_orders,
    (SELECT COUNT(*) FROM orders WHERE status = 'completed') as completed_orders,
    (SELECT COUNT(*) FROM profiles WHERE role = 'agent') as total_agents,
    (SELECT COUNT(*) FROM dealers WHERE is_active = true) as active_dealers,
    (SELECT COALESCE(SUM(CASE WHEN l.commission_status IN ('confirmed', 'paid') THEN COALESCE(l.commission_amount, p.dealer_commission, 200) ELSE 0 END), 0) 
     FROM leads l LEFT JOIN packages p ON l.package_id = p.id) as total_confirmed_revenue,
    (SELECT COALESCE(SUM(COALESCE(p.dealer_commission, 200)), 0) 
     FROM leads l LEFT JOIN packages p ON l.package_id = p.id WHERE l.commission_status = 'pending') as total_pending_revenue;

-- Grant access to views
GRANT SELECT ON dealer_revenue_summary TO authenticated;
GRANT SELECT ON agent_performance_summary TO authenticated;
GRANT SELECT ON dashboard_stats TO authenticated;

-- =====================
-- DEFAULT SETTINGS
-- =====================
INSERT INTO admin_settings (key, value, description) VALUES
    ('commission_auto_confirm', '{"enabled": false, "days": 30}', 'Auto-confirm commissions after X days'),
    ('lead_assignment', '{"mode": "manual", "round_robin": false}', 'Lead assignment settings'),
    ('notifications', '{"email": true, "push": false}', 'Notification preferences'),
    ('data_retention', '{"days": 365}', 'Data retention policy')
ON CONFLICT (key) DO NOTHING;
