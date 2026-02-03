-- =============================================
-- FIX RLS INFINITE RECURSION - RUN THIS FIRST
-- =============================================

-- Step 1: Drop ALL existing policies on profiles to start fresh
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Enable read access for users" ON profiles;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON profiles;
DROP POLICY IF EXISTS "Enable update for users based on id" ON profiles;

-- Step 2: Create or REPLACE is_admin function with SECURITY DEFINER
-- (Don't drop - other policies depend on it)
-- This bypasses RLS when checking admin status, preventing recursion
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() AND role = 'admin'
    );
$$;

-- Step 4: Create simple, non-recursive policies for profiles
-- Users can always view their own profile
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

-- Admins can view all profiles (using the SECURITY DEFINER function)
CREATE POLICY "Admins view all profiles" ON profiles
    FOR SELECT USING (public.is_admin());

-- Admins can insert new profiles
CREATE POLICY "Admins insert profiles" ON profiles
    FOR INSERT WITH CHECK (public.is_admin());

-- Admins can delete profiles
CREATE POLICY "Admins delete profiles" ON profiles
    FOR DELETE USING (public.is_admin());

-- Step 5: Fix policies on other tables too
DROP POLICY IF EXISTS "Admins can view all leads" ON leads;
DROP POLICY IF EXISTS "Admins can manage all leads" ON leads;
DROP POLICY IF EXISTS "Admins can view all orders" ON orders;
DROP POLICY IF EXISTS "Admins can manage all orders" ON orders;
DROP POLICY IF EXISTS "Admins can manage packages" ON packages;

CREATE POLICY "Admins view all leads" ON leads
    FOR SELECT USING (public.is_admin());

CREATE POLICY "Admins manage all leads" ON leads
    FOR ALL USING (public.is_admin());

CREATE POLICY "Admins view all orders" ON orders
    FOR SELECT USING (public.is_admin());

CREATE POLICY "Admins manage all orders" ON orders
    FOR ALL USING (public.is_admin());

CREATE POLICY "Admins manage packages" ON packages
    FOR ALL USING (public.is_admin());

-- Done! The is_admin() function uses SECURITY DEFINER which means
-- it runs with the privileges of the function creator, bypassing RLS
-- and preventing the infinite recursion loop.
