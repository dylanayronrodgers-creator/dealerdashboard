-- Ensure pending_agents table exists with proper RLS
-- Run this in Supabase Dashboard > SQL Editor

CREATE TABLE IF NOT EXISTS pending_agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    dealer_id UUID REFERENCES dealers(id),
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pending_agents_email ON pending_agents(email);
CREATE INDEX IF NOT EXISTS idx_pending_agents_status ON pending_agents(status);

ALTER TABLE pending_agents ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Anyone can insert pending agents" ON pending_agents;
DROP POLICY IF EXISTS "Admins can view pending agents" ON pending_agents;
DROP POLICY IF EXISTS "Admins can manage pending agents" ON pending_agents;
DROP POLICY IF EXISTS "Authenticated users can insert pending agents" ON pending_agents;
DROP POLICY IF EXISTS "Authenticated users can view pending agents" ON pending_agents;
DROP POLICY IF EXISTS "Authenticated users can manage pending agents" ON pending_agents;

-- Permissive policies for authenticated users (admin check is done in app layer)
CREATE POLICY "Authenticated users can insert pending agents" ON pending_agents
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can view pending agents" ON pending_agents
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage pending agents" ON pending_agents
    FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete pending agents" ON pending_agents
    FOR DELETE TO authenticated USING (true);
