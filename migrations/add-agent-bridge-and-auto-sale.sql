-- =====================================================
-- MIGRATION: Bridge profiles ↔ agents + Auto-sale on lead qualified
-- Run this in the shared Supabase SQL editor
-- =====================================================

-- 1. Add agent_table_id to profiles to link admin/agent users to the agents table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS agent_table_id BIGINT REFERENCES agents(id) ON DELETE SET NULL;

-- 2. Add role 'super_admin' to profiles role check (expand allowed roles)
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
  CHECK (role IN ('super_admin', 'admin', 'agent', 'external_agent', 'dealer', 'openserve'));

-- 3. Add permissions JSONB column for granular feature toggles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}'::jsonb;

-- 4. Add assigned_to column on leads so super_admin can assign leads to specific internal agents
ALTER TABLE leads ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- 5. Create function: auto-create sale in sales_log when lead status changes to 'qualified'
CREATE OR REPLACE FUNCTION on_lead_qualified_create_sale()
RETURNS TRIGGER AS $$
DECLARE
  v_agent_table_id BIGINT;
  v_package_name TEXT;
  v_package_price DECIMAL;
  v_agent_profile RECORD;
BEGIN
  -- Only fire when status changes TO 'qualified'
  IF NEW.status = 'qualified' AND (OLD.status IS NULL OR OLD.status != 'qualified') THEN
    
    -- Get the agent's profile to find their agent_table_id
    SELECT agent_table_id INTO v_agent_table_id
    FROM profiles
    WHERE id = NEW.agent_id;
    
    -- If no agent_table_id linked, skip
    IF v_agent_table_id IS NULL THEN
      RAISE NOTICE 'No agent_table_id for profile %, skipping auto-sale', NEW.agent_id;
      RETURN NEW;
    END IF;
    
    -- Get package info if available
    SELECT name, price INTO v_package_name, v_package_price
    FROM packages
    WHERE id = NEW.package_id;
    
    -- Insert into sales_log
    INSERT INTO sales_log (
      agent_id,
      lead_id,
      account_number,
      service_id,
      package_name,
      category,
      provider,
      total_sale,
      sale_status,
      status_reason,
      sale_origin,
      notes,
      commission_status,
      import_source,
      created_at
    ) VALUES (
      v_agent_table_id,
      NEW.id,
      COALESCE(NEW.lead_id, 'LEAD-' || NEW.id::text),
      NULL,
      COALESCE(v_package_name, 'Openserve Package'),
      'Fibre',
      'Openserve',
      COALESCE(v_package_price, 0),
      'Pending',
      'Awaiting Provider Completion',
      'Incoming Sales Leads',
      'Auto-created from qualified lead #' || NEW.id::text || ' - ' || COALESCE(NEW.full_name, ''),
      'Does Not Count',
      'AUTO_LEAD',
      NOW()
    );
    
    RAISE NOTICE 'Auto-sale created for lead % -> agent_table_id %', NEW.id, v_agent_table_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Create trigger on leads table
DROP TRIGGER IF EXISTS trigger_lead_qualified_sale ON leads;
CREATE TRIGGER trigger_lead_qualified_sale
  AFTER UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION on_lead_qualified_create_sale();

-- 7. Index for performance
CREATE INDEX IF NOT EXISTS idx_profiles_agent_table_id ON profiles(agent_table_id);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_sales_log_lead_id ON sales_log(lead_id);

-- 8. RLS policy: allow authenticated users to read agents table
DROP POLICY IF EXISTS "Authenticated users can read agents" ON agents;
CREATE POLICY "Authenticated users can read agents" ON agents
  FOR SELECT USING (auth.role() = 'authenticated');

-- 9. RLS policy: allow authenticated users to insert/update sales_log
DROP POLICY IF EXISTS "Authenticated users can manage sales_log" ON sales_log;
CREATE POLICY "Authenticated users can manage sales_log" ON sales_log
  FOR ALL USING (auth.role() = 'authenticated');

-- 10. RLS policy: allow authenticated users to manage agent_reminders
DROP POLICY IF EXISTS "Authenticated users can manage agent_reminders" ON agent_reminders;
CREATE POLICY "Authenticated users can manage agent_reminders" ON agent_reminders
  FOR ALL USING (auth.role() = 'authenticated');

-- 11. RLS policy: allow authenticated users to read axxess_pricing
DROP POLICY IF EXISTS "Authenticated users can read axxess_pricing" ON axxess_pricing;
CREATE POLICY "Authenticated users can read axxess_pricing" ON axxess_pricing
  FOR SELECT USING (auth.role() = 'authenticated');

-- 12. RLS policy: allow authenticated users to read teams
DROP POLICY IF EXISTS "Authenticated users can read teams" ON teams;
CREATE POLICY "Authenticated users can read teams" ON teams
  FOR SELECT USING (auth.role() = 'authenticated');

-- 13. RLS policy: service_status_checks
DROP POLICY IF EXISTS "Authenticated users can manage service_status_checks" ON service_status_checks;
CREATE POLICY "Authenticated users can manage service_status_checks" ON service_status_checks
  FOR ALL USING (auth.role() = 'authenticated');

-- =====================================================
-- DONE: After running this, link profiles to agents by setting
-- profiles.agent_table_id = agents.id for each matching user
-- =====================================================
