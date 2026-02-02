-- ============================================
-- COMPLETE SUPABASE SCHEMA FOR AXXESS DEALER PORTAL
-- Run this in your Supabase SQL Editor
-- Last Updated: Feb 2026
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. DEALERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS dealers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    contact_email TEXT,
    contact_phone TEXT,
    address TEXT,
    commission_rate DECIMAL(5,2) DEFAULT 10.00,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. PROFILES TABLE (extends Supabase auth.users)
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    phone TEXT,
    role TEXT NOT NULL DEFAULT 'agent' CHECK (role IN ('admin', 'agent')),
    dealer_id UUID REFERENCES dealers(id) ON DELETE SET NULL,
    team_type TEXT DEFAULT 'internal' CHECK (team_type IN ('internal', 'external')),
    commission_rate DECIMAL(5,2) DEFAULT 5.00,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. PACKAGES TABLE (Openserve fibre packages)
-- ============================================
CREATE TABLE IF NOT EXISTS packages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    speed INTEGER NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    description TEXT,
    product_type TEXT DEFAULT 'postpaid' CHECK (product_type IN ('postpaid', 'prepaid')),
    dealer_commission DECIMAL(10,2) DEFAULT 200.00,
    agent_commission DECIMAL(10,2) DEFAULT 50.00,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. PACKAGE ALIASES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS package_aliases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    package_id UUID REFERENCES packages(id) ON DELETE CASCADE,
    alias TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(alias)
);

-- ============================================
-- 5. LEADS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id TEXT UNIQUE,
    first_name TEXT,
    last_name TEXT,
    full_name TEXT,
    id_number TEXT,
    email TEXT,
    phone TEXT,
    address TEXT,
    package_id UUID REFERENCES packages(id) ON DELETE SET NULL,
    agent_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    dealer_id UUID REFERENCES dealers(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'converted', 'lost', 'returned')),
    lead_type TEXT,
    isp TEXT DEFAULT 'Openserve',
    notes TEXT,
    return_reason TEXT,
    returned_at TIMESTAMPTZ,
    admin_message TEXT,
    sent_to_admin_at TIMESTAMPTZ,
    commission_status TEXT DEFAULT 'pending' CHECK (commission_status IN ('pending', 'confirmed', 'rejected', 'paid')),
    commission_amount DECIMAL(10,2),
    confirmed_at TIMESTAMPTZ,
    rejected_at TIMESTAMPTZ,
    rejection_reason TEXT,
    secondary_contact_name TEXT,
    secondary_contact_number TEXT,
    secondary_contact_email TEXT,
    order_number TEXT,
    order_status TEXT,
    order_date TIMESTAMPTZ,
    date_captured TIMESTAMPTZ,
    last_updated TIMESTAMPTZ,
    captured_by_email TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 6. ORDERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    package_id UUID REFERENCES packages(id) ON DELETE SET NULL,
    agent_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'scheduled', 'completed', 'cancelled', 'returned')),
    notes TEXT,
    return_reason TEXT,
    returned_at TIMESTAMPTZ,
    admin_message TEXT,
    sent_to_admin_at TIMESTAMPTZ,
    scheduled_date DATE,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 7. PENDING AGENTS TABLE
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

-- ============================================
-- 8. SYSTEM SETTINGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS system_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key TEXT UNIQUE NOT NULL,
    value JSONB NOT NULL DEFAULT '{}',
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 9. CREATE INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_leads_agent_id ON leads(agent_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_lead_id ON leads(lead_id);
CREATE INDEX IF NOT EXISTS idx_leads_dealer_id ON leads(dealer_id);
CREATE INDEX IF NOT EXISTS idx_orders_agent_id ON orders(agent_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_lead_id ON orders(lead_id);
CREATE INDEX IF NOT EXISTS idx_profiles_dealer_id ON profiles(dealer_id);
CREATE INDEX IF NOT EXISTS idx_pending_agents_email ON pending_agents(email);

-- ============================================
-- 10. ENABLE ROW LEVEL SECURITY
-- ============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE dealers ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE package_aliases ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 11. HELPER FUNCTION TO CHECK ADMIN STATUS
-- ============================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $func$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() AND role = 'admin'
    );
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================
-- 12. RLS POLICIES - PROFILES
-- ============================================
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON profiles;

CREATE POLICY "Users can view their own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON profiles
    FOR SELECT USING (public.is_admin());

CREATE POLICY "Admins can insert profiles" ON profiles
    FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete profiles" ON profiles
    FOR DELETE USING (public.is_admin());

-- ============================================
-- 13. RLS POLICIES - PACKAGES
-- ============================================
DROP POLICY IF EXISTS "Anyone can view packages" ON packages;
DROP POLICY IF EXISTS "Admins can manage packages" ON packages;

CREATE POLICY "Anyone can view packages" ON packages
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage packages" ON packages
    FOR ALL USING (public.is_admin());

-- ============================================
-- 14. RLS POLICIES - LEADS
-- ============================================
DROP POLICY IF EXISTS "Agents can view their own leads" ON leads;
DROP POLICY IF EXISTS "Agents can insert leads" ON leads;
DROP POLICY IF EXISTS "Agents can update their own leads" ON leads;
DROP POLICY IF EXISTS "Admins can view all leads" ON leads;
DROP POLICY IF EXISTS "Admins can manage all leads" ON leads;

CREATE POLICY "Agents can view their own leads" ON leads
    FOR SELECT USING (agent_id = auth.uid());

CREATE POLICY "Agents can insert leads" ON leads
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Agents can update their own leads" ON leads
    FOR UPDATE USING (agent_id = auth.uid());

CREATE POLICY "Admins can view all leads" ON leads
    FOR SELECT USING (public.is_admin());

CREATE POLICY "Admins can manage all leads" ON leads
    FOR ALL USING (public.is_admin());

-- ============================================
-- 15. RLS POLICIES - ORDERS
-- ============================================
DROP POLICY IF EXISTS "Agents can view their own orders" ON orders;
DROP POLICY IF EXISTS "Agents can insert orders" ON orders;
DROP POLICY IF EXISTS "Agents can update their own orders" ON orders;
DROP POLICY IF EXISTS "Admins can view all orders" ON orders;
DROP POLICY IF EXISTS "Admins can manage all orders" ON orders;

CREATE POLICY "Agents can view their own orders" ON orders
    FOR SELECT USING (agent_id = auth.uid());

CREATE POLICY "Agents can insert orders" ON orders
    FOR INSERT WITH CHECK (agent_id = auth.uid());

CREATE POLICY "Agents can update their own orders" ON orders
    FOR UPDATE USING (agent_id = auth.uid());

CREATE POLICY "Admins can view all orders" ON orders
    FOR SELECT USING (public.is_admin());

CREATE POLICY "Admins can manage all orders" ON orders
    FOR ALL USING (public.is_admin());

-- ============================================
-- 16. RLS POLICIES - DEALERS
-- ============================================
DROP POLICY IF EXISTS "Anyone can view dealers" ON dealers;
DROP POLICY IF EXISTS "Admins can manage dealers" ON dealers;

CREATE POLICY "Anyone can view dealers" ON dealers
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage dealers" ON dealers
    FOR ALL USING (public.is_admin());

-- ============================================
-- 17. RLS POLICIES - PENDING AGENTS
-- ============================================
DROP POLICY IF EXISTS "Anyone can insert pending agents" ON pending_agents;
DROP POLICY IF EXISTS "Admins can view pending agents" ON pending_agents;
DROP POLICY IF EXISTS "Admins can manage pending agents" ON pending_agents;

CREATE POLICY "Anyone can insert pending agents" ON pending_agents
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can view pending agents" ON pending_agents
    FOR SELECT USING (public.is_admin());

CREATE POLICY "Admins can manage pending agents" ON pending_agents
    FOR ALL USING (public.is_admin());

-- ============================================
-- 18. RLS POLICIES - SYSTEM SETTINGS
-- ============================================
DROP POLICY IF EXISTS "Anyone can view system settings" ON system_settings;
DROP POLICY IF EXISTS "Admins can manage system settings" ON system_settings;

CREATE POLICY "Anyone can view system settings" ON system_settings
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage system settings" ON system_settings
    FOR ALL USING (public.is_admin());

-- ============================================
-- 19. RLS POLICIES - PACKAGE ALIASES
-- ============================================
DROP POLICY IF EXISTS "Anyone can view package aliases" ON package_aliases;
DROP POLICY IF EXISTS "Admins can manage package aliases" ON package_aliases;

CREATE POLICY "Anyone can view package aliases" ON package_aliases
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage package aliases" ON package_aliases
    FOR ALL USING (public.is_admin());

-- ============================================
-- 20. FUNCTIONS
-- ============================================

-- Function to find package by name or alias
DROP FUNCTION IF EXISTS public.find_package_id(text);
CREATE OR REPLACE FUNCTION public.find_package_id(p_name TEXT)
RETURNS UUID AS $func$
DECLARE
    found_id UUID;
BEGIN
    SELECT id INTO found_id FROM packages WHERE LOWER(name) = LOWER(p_name) LIMIT 1;
    IF found_id IS NOT NULL THEN RETURN found_id; END IF;
    
    SELECT package_id INTO found_id FROM package_aliases WHERE LOWER(alias) = LOWER(p_name) LIMIT 1;
    IF found_id IS NOT NULL THEN RETURN found_id; END IF;
    
    SELECT id INTO found_id FROM packages WHERE LOWER(name) LIKE '%' || LOWER(p_name) || '%' LIMIT 1;
    IF found_id IS NOT NULL THEN RETURN found_id; END IF;
    
    SELECT id INTO found_id FROM packages WHERE p_name ~* (speed::TEXT || '.*mbps') ORDER BY speed DESC LIMIT 1;
    
    RETURN found_id;
END;
$func$ LANGUAGE plpgsql STABLE;

-- Function to confirm lead and calculate commission
DROP FUNCTION IF EXISTS confirm_lead(uuid);
CREATE OR REPLACE FUNCTION confirm_lead(p_lead_id UUID)
RETURNS void AS $func$
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
$func$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to reject lead
DROP FUNCTION IF EXISTS reject_lead(uuid, text);
CREATE OR REPLACE FUNCTION reject_lead(p_lead_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS void AS $func$
BEGIN
    UPDATE leads SET
        commission_status = 'rejected',
        rejected_at = NOW(),
        rejection_reason = p_reason,
        status = 'lost'
    WHERE id = p_lead_id;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $func$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        COALESCE(NEW.raw_user_meta_data->>'role', 'agent')
    );
    RETURN NEW;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 21. INSERT DEFAULT PACKAGES
-- ============================================
INSERT INTO packages (name, speed, price, description, dealer_commission) VALUES
    ('Webconnect 20/10Mbps', 20, 399.00, '20Mbps download / 10Mbps upload uncapped', 200.00),
    ('Webconnect 50/25Mbps', 50, 549.00, '50Mbps download / 25Mbps upload uncapped', 200.00),
    ('Webconnect 100/50Mbps', 100, 699.00, '100Mbps download / 50Mbps upload uncapped', 200.00),
    ('Webconnect 200/100Mbps', 200, 899.00, '200Mbps download / 100Mbps upload uncapped', 200.00),
    ('Webconnect 500/250Mbps', 500, 1199.00, '500Mbps download / 250Mbps upload uncapped', 200.00),
    ('Webconnect 1000/500Mbps', 1000, 1499.00, '1Gbps download / 500Mbps upload uncapped', 200.00)
ON CONFLICT DO NOTHING;

-- ============================================
-- 22. INSERT DEFAULT SYSTEM SETTINGS
-- ============================================
INSERT INTO system_settings (key, value, description) VALUES
    ('openserve_api', '{"enabled": false, "api_key": "", "api_url": ""}', 'Openserve API configuration'),
    ('general', '{"company_name": "Axxess", "default_commission": 200}', 'General system settings')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- SETUP COMPLETE!
-- To create admin user, run:
-- UPDATE profiles SET role = 'admin' WHERE email = 'your-admin@email.com';
-- ============================================
