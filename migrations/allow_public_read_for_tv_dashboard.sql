-- Allow anonymous/public read access for TV Dashboard
-- This enables the TV dashboard to display data without requiring login

-- Enable RLS on tables if not already enabled
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE dealers ENABLE ROW LEVEL SECURITY;
ALTER TABLE packages ENABLE ROW LEVEL SECURITY;

-- Allow anonymous users to read leads (for TV dashboard)
DROP POLICY IF EXISTS "Allow public read for leads" ON leads;
CREATE POLICY "Allow public read for leads" ON leads
    FOR SELECT
    USING (true);

-- Allow anonymous users to read orders (for TV dashboard)
DROP POLICY IF EXISTS "Allow public read for orders" ON orders;
CREATE POLICY "Allow public read for orders" ON orders
    FOR SELECT
    USING (true);

-- Allow anonymous users to read agent profiles (for TV dashboard)
DROP POLICY IF EXISTS "Allow public read for profiles" ON profiles;
CREATE POLICY "Allow public read for profiles" ON profiles
    FOR SELECT
    USING (true);

-- Allow anonymous users to read dealers (for TV dashboard)
DROP POLICY IF EXISTS "Allow public read for dealers" ON dealers;
CREATE POLICY "Allow public read for dealers" ON dealers
    FOR SELECT
    USING (true);

-- Allow anonymous users to read packages (for TV dashboard)
DROP POLICY IF EXISTS "Allow public read for packages" ON packages;
CREATE POLICY "Allow public read for packages" ON packages
    FOR SELECT
    USING (true);

-- Grant usage on schema to anon role
GRANT USAGE ON SCHEMA public TO anon;

-- Grant select permissions to anon role
GRANT SELECT ON leads TO anon;
GRANT SELECT ON orders TO anon;
GRANT SELECT ON profiles TO anon;
GRANT SELECT ON dealers TO anon;
GRANT SELECT ON packages TO anon;
