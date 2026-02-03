-- Fix the profiles_role_check constraint to include 'dealer' role
-- The current constraint doesn't allow 'dealer' as a valid role value

-- Drop the existing check constraint
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- Add updated check constraint that includes 'dealer' role
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
    CHECK (role IN ('admin', 'agent', 'dealer', 'dealer_agent'));

-- Verify the constraint was added correctly
-- SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'profiles'::regclass;
