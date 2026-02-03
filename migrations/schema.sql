-- Supabase Schema for Axxess Dealer Portal
-- Run this in the Supabase SQL Editor to set up all tables

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

-- Add foreign key for dealer_id in profiles (drop first if exists)
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
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
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
    
    -- Order Tracking (Universal IDs)
    service_id TEXT,              -- Internal ID from Openserve
    order_number TEXT,            -- Universal Order Number
    
    -- Lead Details
    agent_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    dealer_id UUID REFERENCES dealers(id) ON DELETE SET NULL,
    package_id UUID REFERENCES packages(id) ON DELETE SET NULL,
    source TEXT DEFAULT 'direct',
    
    -- Status Fields
    status TEXT DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'converted', 'lost')),
    order_status TEXT CHECK (order_status IN ('pending', 'processing', 'scheduled', 'in_progress', 'completed', 'cancelled', 'returned')),
    commission_status TEXT DEFAULT 'pending' CHECK (commission_status IN ('pending', 'confirmed', 'paid', 'rejected')),
    
    -- Commission & Financial
    commission_amount DECIMAL(10,2) DEFAULT 0,
    package_price DECIMAL(10,2) DEFAULT 0,
    
    -- Scheduling
    scheduled_date TIMESTAMPTZ,
    installation_date TIMESTAMPTZ,
    
    -- Return Information
    return_reason TEXT,
    returned_by UUID REFERENCES profiles(id),
    returned_at TIMESTAMPTZ,
    
    -- Notes
    notes TEXT,
    agent_notes TEXT,
    admin_notes TEXT,
    openserve_notes TEXT,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    converted_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

-- =====================
-- RETURNED ITEMS TABLE
-- =====================
CREATE TABLE IF NOT EXISTS returned_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    returned_by UUID REFERENCES profiles(id),
    reason TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'acknowledged', 'resolved', 'rejected')),
    resolution_notes TEXT,
    resolved_by UUID REFERENCES profiles(id),
    resolved_at TIMESTAMPTZ,
    
    -- Hierarchy flow fields
    return_direction TEXT DEFAULT 'to_admin' CHECK (return_direction IN ('to_openserve', 'to_admin', 'to_agent')),
    target_user_id UUID REFERENCES profiles(id),
    source_role TEXT,
    target_role TEXT,
    
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
CREATE INDEX IF NOT EXISTS idx_profiles_dealer_id ON profiles(dealer_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_returned_items_lead_id ON returned_items(lead_id);

-- =====================
-- ROW LEVEL SECURITY
-- =====================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE dealers ENABLE ROW LEVEL SECURITY;
ALTER TABLE packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE returned_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_privileges ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
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
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
DROP POLICY IF EXISTS "Only admins can access settings" ON admin_settings;
DROP POLICY IF EXISTS "Admins can manage privileges" ON user_privileges;
DROP POLICY IF EXISTS "Users can view own privileges" ON user_privileges;

-- Profiles Policies
CREATE POLICY "Public profiles are viewable by everyone" ON profiles
    FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can update any profile" ON profiles
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Dealers Policies
CREATE POLICY "Dealers are viewable by everyone" ON dealers
    FOR SELECT USING (true);

CREATE POLICY "Only admins can modify dealers" ON dealers
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Packages Policies
CREATE POLICY "Packages are viewable by everyone" ON packages
    FOR SELECT USING (true);

CREATE POLICY "Only admins can modify packages" ON packages
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Leads Policies
CREATE POLICY "Leads are viewable by related users" ON leads
    FOR SELECT USING (
        auth.uid() = agent_id OR
        auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin') OR
        auth.uid() IN (SELECT id FROM profiles WHERE role = 'openserve') OR
        dealer_id IN (SELECT dealer_id FROM profiles WHERE id = auth.uid())
    );

CREATE POLICY "Agents can insert leads" ON leads
    FOR INSERT WITH CHECK (
        auth.uid() = agent_id OR
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'agent', 'openserve'))
    );

CREATE POLICY "Users can update accessible leads" ON leads
    FOR UPDATE USING (
        auth.uid() = agent_id OR
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'openserve'))
    );

-- Notifications Policies
CREATE POLICY "Users can view own notifications" ON notifications
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" ON notifications
    FOR UPDATE USING (auth.uid() = user_id);

-- Admin Settings Policies
CREATE POLICY "Only admins can access settings" ON admin_settings
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- User Privileges Policies
CREATE POLICY "Admins can manage privileges" ON user_privileges
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Users can view own privileges" ON user_privileges
    FOR SELECT USING (auth.uid() = user_id);

-- =====================
-- FUNCTIONS & TRIGGERS
-- =====================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop existing triggers to avoid conflicts (only for tables that exist)
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
DROP TRIGGER IF EXISTS update_dealers_updated_at ON dealers;
DROP TRIGGER IF EXISTS update_packages_updated_at ON packages;
DROP TRIGGER IF EXISTS update_leads_updated_at ON leads;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Drop returned_items trigger only if table exists
DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'returned_items') THEN
        DROP TRIGGER IF EXISTS update_returned_items_updated_at ON returned_items;
    END IF;
END $$;

-- Apply updated_at triggers
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dealers_updated_at
    BEFORE UPDATE ON dealers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_packages_updated_at
    BEFORE UPDATE ON packages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leads_updated_at
    BEFORE UPDATE ON leads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_returned_items_updated_at
    BEFORE UPDATE ON returned_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        'agent'
    );
    RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- Trigger to auto-create profile on signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================
-- SAMPLE DATA (Optional)
-- =====================

-- Add missing columns to packages if they don't exist
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'packages' AND column_name = 'data_cap') THEN
        ALTER TABLE packages ADD COLUMN data_cap TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'packages' AND column_name = 'contract_term') THEN
        ALTER TABLE packages ADD COLUMN contract_term INTEGER DEFAULT 24;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'packages' AND column_name = 'provider') THEN
        ALTER TABLE packages ADD COLUMN provider TEXT DEFAULT 'Openserve';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'packages' AND column_name = 'commission_amount') THEN
        ALTER TABLE packages ADD COLUMN commission_amount DECIMAL(10,2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'packages' AND column_name = 'description') THEN
        ALTER TABLE packages ADD COLUMN description TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'packages' AND column_name = 'speed') THEN
        ALTER TABLE packages ADD COLUMN speed TEXT;
    END IF;
END $$;

-- Skip default package inserts - packages already exist in database
-- If you need to add packages, do so manually or via the admin dashboard

-- Insert default admin settings
INSERT INTO admin_settings (key, value, description) VALUES
    ('commission_auto_confirm', '{"enabled": false, "days": 30}', 'Auto-confirm commissions after X days'),
    ('lead_assignment', '{"mode": "manual", "round_robin": false}', 'Lead assignment settings'),
    ('notifications', '{"email": true, "push": false}', 'Notification preferences'),
    ('data_retention', '{"days": 365}', 'Data retention policy')
ON CONFLICT (key) DO NOTHING;
