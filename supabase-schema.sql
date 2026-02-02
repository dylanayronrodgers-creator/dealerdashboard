-- Supabase Database Schema for Axxess Dealer Portal
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    phone TEXT,
    role TEXT NOT NULL DEFAULT 'agent' CHECK (role IN ('admin', 'agent')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Packages table (Openserve fibre packages)
CREATE TABLE IF NOT EXISTS packages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    speed INTEGER NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Leads table
CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    id_number UUID,  -- Client ID number stored as UUID for security
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    address TEXT,
    package_id UUID REFERENCES packages(id) ON DELETE SET NULL,
    agent_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'converted', 'lost', 'returned')),
    notes TEXT,
    return_reason TEXT,
    returned_at TIMESTAMPTZ,
    admin_message TEXT,
    sent_to_admin_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Orders table
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

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_leads_agent_id ON leads(agent_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_orders_agent_id ON orders(agent_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_lead_id ON orders(lead_id);

-- Row Level Security (RLS) Policies

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON profiles
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Admins can insert profiles" ON profiles
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Admins can delete profiles" ON profiles
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Packages policies (everyone can read, only admins can modify)
CREATE POLICY "Anyone can view packages" ON packages
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage packages" ON packages
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Leads policies
CREATE POLICY "Agents can view their own leads" ON leads
    FOR SELECT USING (agent_id = auth.uid());

CREATE POLICY "Agents can insert leads" ON leads
    FOR INSERT WITH CHECK (agent_id = auth.uid());

CREATE POLICY "Agents can update their own leads" ON leads
    FOR UPDATE USING (agent_id = auth.uid());

CREATE POLICY "Admins can view all leads" ON leads
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Admins can manage all leads" ON leads
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Orders policies
CREATE POLICY "Agents can view their own orders" ON orders
    FOR SELECT USING (agent_id = auth.uid());

CREATE POLICY "Agents can insert orders" ON orders
    FOR INSERT WITH CHECK (agent_id = auth.uid());

CREATE POLICY "Agents can update their own orders" ON orders
    FOR UPDATE USING (agent_id = auth.uid());

CREATE POLICY "Admins can view all orders" ON orders
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Admins can manage all orders" ON orders
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Function to automatically create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to call the function on new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Insert some default packages
INSERT INTO packages (name, speed, price, description) VALUES
    ('Fibre 25Mbps', 25, 499.00, 'Perfect for light browsing and email'),
    ('Fibre 50Mbps', 50, 699.00, 'Great for streaming and working from home'),
    ('Fibre 100Mbps', 100, 899.00, 'Ideal for families and multiple devices'),
    ('Fibre 200Mbps', 200, 1099.00, 'Ultra-fast for power users'),
    ('Fibre 500Mbps', 500, 1499.00, 'Premium speed for demanding users'),
    ('Fibre 1Gbps', 1000, 1999.00, 'Maximum speed for ultimate performance')
ON CONFLICT DO NOTHING;

-- Create the first admin user (run this after creating the user in Supabase Auth)
-- UPDATE profiles SET role = 'admin' WHERE email = 'your-admin-email@example.com';
