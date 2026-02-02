-- Safe Setup Script - Won't overwrite existing data
-- Run this in Supabase SQL Editor

-- Step 1: Create is_admin function (SECURITY DEFINER bypasses RLS to prevent recursion)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $func$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() AND role = 'admin'
    );
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Step 2: Drop existing policies first (prevents duplicate errors)
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON profiles;
DROP POLICY IF EXISTS "Anyone can view packages" ON packages;
DROP POLICY IF EXISTS "Admins can manage packages" ON packages;
DROP POLICY IF EXISTS "Agents can view their own leads" ON leads;
DROP POLICY IF EXISTS "Agents can insert leads" ON leads;
DROP POLICY IF EXISTS "Agents can update their own leads" ON leads;
DROP POLICY IF EXISTS "Admins can view all leads" ON leads;
DROP POLICY IF EXISTS "Admins can manage all leads" ON leads;
DROP POLICY IF EXISTS "Agents can view their own orders" ON orders;
DROP POLICY IF EXISTS "Agents can insert orders" ON orders;
DROP POLICY IF EXISTS "Agents can update their own orders" ON orders;
DROP POLICY IF EXISTS "Admins can view all orders" ON orders;
DROP POLICY IF EXISTS "Admins can manage all orders" ON orders;

-- Step 3: Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Step 4: Profiles policies (using is_admin() function)
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

-- Step 5: Packages policies
CREATE POLICY "Anyone can view packages" ON packages
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage packages" ON packages
    FOR ALL USING (public.is_admin());

-- Step 6: Leads policies
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

-- Step 7: Orders policies
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
