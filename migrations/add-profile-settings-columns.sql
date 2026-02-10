-- =====================================================
-- MIGRATION: Add profile settings columns for internal agents
-- Run this in the shared Supabase SQL editor
-- =====================================================

-- 1. Add profile picture URL column
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_picture TEXT;

-- 2. Add color scheme preference column
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS color_scheme TEXT DEFAULT 'default';

-- 3. Expand role check to include 'internal_agent'
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
  CHECK (role IN ('super_admin', 'admin', 'agent', 'internal_agent', 'external_agent', 'dealer', 'openserve'));
