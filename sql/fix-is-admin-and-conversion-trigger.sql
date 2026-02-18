-- =====================================================
-- FIX: is_admin() to include super_admin role
-- FIX: Auto-sale trigger to fire on CONVERTED (not just qualified)
-- FIX: pending_agents RLS policies
-- Run this in Supabase Dashboard > SQL Editor
-- =====================================================

-- 1. Fix is_admin() to include super_admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    );
$$;

-- 2. Fix pending_agents RLS - drop old restrictive policies, add permissive ones
DROP POLICY IF EXISTS "Anyone can insert pending agents" ON pending_agents;
DROP POLICY IF EXISTS "Admins can view pending agents" ON pending_agents;
DROP POLICY IF EXISTS "Admins can manage pending agents" ON pending_agents;
DROP POLICY IF EXISTS "Authenticated users can insert pending agents" ON pending_agents;
DROP POLICY IF EXISTS "Authenticated users can view pending agents" ON pending_agents;
DROP POLICY IF EXISTS "Authenticated users can manage pending agents" ON pending_agents;
DROP POLICY IF EXISTS "Authenticated users can delete pending agents" ON pending_agents;

CREATE POLICY "Authenticated users can insert pending agents" ON pending_agents
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can view pending agents" ON pending_agents
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage pending agents" ON pending_agents
    FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete pending agents" ON pending_agents
    FOR DELETE TO authenticated USING (true);

-- 3. Add internal_agent_id column to leads if not exists
-- This tracks the internal agent separately from the dealer agent (agent_id)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS internal_agent_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_leads_internal_agent_id ON leads(internal_agent_id);

-- 4. Update the auto-sale trigger to fire on CONVERTED status (not just qualified)
-- Also check internal_agent_id for the agent link
CREATE OR REPLACE FUNCTION on_lead_qualified_create_sale()
RETURNS TRIGGER AS $$
DECLARE
  v_agent_table_id BIGINT;
  v_package_name TEXT;
  v_package_price DECIMAL;
  v_profile_id UUID;
BEGIN
  -- Fire when status changes TO 'qualified' OR 'converted'
  IF (NEW.status = 'qualified' AND (OLD.status IS NULL OR OLD.status != 'qualified'))
     OR (NEW.status = 'converted' AND (OLD.status IS NULL OR OLD.status != 'converted')) THEN
    
    -- Priority: internal_agent_id > assigned_to > agent_id
    v_profile_id := COALESCE(NEW.internal_agent_id, NEW.assigned_to, NEW.agent_id);
    
    IF v_profile_id IS NULL THEN
      RAISE NOTICE 'No agent on lead %, skipping auto-sale', NEW.id;
      RETURN NEW;
    END IF;
    
    -- Get the agent's profile to find their agent_table_id
    SELECT agent_table_id INTO v_agent_table_id
    FROM profiles
    WHERE id = v_profile_id;
    
    -- Fallback: try assigned_to if different
    IF v_agent_table_id IS NULL AND NEW.assigned_to IS NOT NULL AND NEW.assigned_to != v_profile_id THEN
      SELECT agent_table_id INTO v_agent_table_id
      FROM profiles
      WHERE id = NEW.assigned_to;
    END IF;
    
    -- Fallback: try agent_id if different
    IF v_agent_table_id IS NULL AND NEW.agent_id IS NOT NULL AND NEW.agent_id != v_profile_id THEN
      SELECT agent_table_id INTO v_agent_table_id
      FROM profiles
      WHERE id = NEW.agent_id;
    END IF;
    
    -- If still no agent_table_id linked, skip
    IF v_agent_table_id IS NULL THEN
      RAISE NOTICE 'No agent_table_id for lead %, skipping auto-sale', NEW.id;
      RETURN NEW;
    END IF;
    
    -- Check if sale already exists for this lead (avoid duplicates)
    IF EXISTS (SELECT 1 FROM sales_log WHERE lead_id = NEW.id) THEN
      -- If converting (not just qualifying), update the existing sale status
      IF NEW.status = 'converted' THEN
        UPDATE sales_log 
        SET sale_status = 'Pending',
            status_reason = 'Lead Converted - Awaiting Activation',
            notes = 'Lead converted to order - ' || COALESCE(NEW.full_name, ''),
            updated_at = NOW()
        WHERE lead_id = NEW.id;
        RAISE NOTICE 'Updated existing sale for converted lead %', NEW.id;
      END IF;
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
      COALESCE(NEW.order_number, NEW.lead_id, 'LEAD-' || NEW.id::text),
      NEW.service_id,
      COALESCE(v_package_name, 'Fibre Package'),
      'Fibre',
      'Openserve',
      COALESCE(v_package_price, 0),
      CASE WHEN NEW.status = 'converted' THEN 'Pending' ELSE 'Pending' END,
      CASE WHEN NEW.status = 'converted' THEN 'Lead Converted - Awaiting Activation' ELSE 'Awaiting Provider Completion' END,
      'Incoming Sales Leads',
      CASE WHEN NEW.status = 'converted' 
        THEN 'Converted lead - ' || COALESCE(NEW.full_name, '') || ' - Order: ' || COALESCE(NEW.order_number, 'N/A')
        ELSE 'Qualified lead - ' || COALESCE(NEW.full_name, '')
      END,
      'Does Not Count',
      'AUTO_LEAD',
      NOW()
    );
    
    RAISE NOTICE 'Auto-sale created for lead % (status: %) -> agent_table_id %', NEW.id, NEW.status, v_agent_table_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger
DROP TRIGGER IF EXISTS trigger_lead_qualified_sale ON leads;
CREATE TRIGGER trigger_lead_qualified_sale
  AFTER UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION on_lead_qualified_create_sale();

-- =====================================================
-- DONE! This migration:
-- 1. Fixes is_admin() to recognize super_admin role
-- 2. Fixes pending_agents RLS so you can read/write
-- 3. Adds internal_agent_id column to leads
-- 4. Updates trigger to create sales_log on CONVERTED (not just qualified)
-- =====================================================
