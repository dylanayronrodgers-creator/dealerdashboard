-- Fix RLS Infinite Recursion
-- Run this in Supabase SQL Editor

-- Step 1: Create a security definer function to check admin status
-- This bypasses RLS and prevents recursion
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Step 2: Drop all existing profile policies
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON profiles;

-- Step 3: Recreate policies using the function
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

-- Step 4: Fix leads policies
DROP POLICY IF EXISTS "Admins can view all leads" ON leads;
DROP POLICY IF EXISTS "Admins can manage all leads" ON leads;

CREATE POLICY "Admins can view all leads" ON leads
    FOR SELECT USING (public.is_admin());

CREATE POLICY "Admins can manage all leads" ON leads
    FOR ALL USING (public.is_admin());

-- Step 5: Fix orders policies  
DROP POLICY IF EXISTS "Admins can view all orders" ON orders;
DROP POLICY IF EXISTS "Admins can manage all orders" ON orders;

CREATE POLICY "Admins can view all orders" ON orders
    FOR SELECT USING (public.is_admin());

CREATE POLICY "Admins can manage all orders" ON orders
    FOR ALL USING (public.is_admin());

-- Step 6: Fix packages policies
DROP POLICY IF EXISTS "Admins can manage packages" ON packages;

CREATE POLICY "Admins can manage packages" ON packages
    FOR ALL USING (public.is_admin());
