-- =====================================================
-- MIGRATION: Fix auto-sale trigger to check assigned_to
-- The original trigger only checked agent_id, but internal
-- agents get leads via assigned_to. This version checks both.
-- Run this in the shared Supabase SQL editor.
-- =====================================================

CREATE OR REPLACE FUNCTION on_lead_qualified_create_sale()
RETURNS TRIGGER AS $$
DECLARE
  v_agent_table_id BIGINT;
  v_package_name TEXT;
  v_package_price DECIMAL;
  v_profile_id UUID;
BEGIN
  -- Only fire when status changes TO 'qualified'
  IF NEW.status = 'qualified' AND (OLD.status IS NULL OR OLD.status != 'qualified') THEN
    
    -- Try agent_id first, then fall back to assigned_to
    v_profile_id := COALESCE(NEW.agent_id, NEW.assigned_to);
    
    IF v_profile_id IS NULL THEN
      RAISE NOTICE 'No agent_id or assigned_to on lead %, skipping auto-sale', NEW.id;
      RETURN NEW;
    END IF;
    
    -- Get the agent's profile to find their agent_table_id
    SELECT agent_table_id INTO v_agent_table_id
    FROM profiles
    WHERE id = v_profile_id;
    
    -- If agent_id had no agent_table_id, try assigned_to as fallback
    IF v_agent_table_id IS NULL AND NEW.assigned_to IS NOT NULL AND NEW.assigned_to != v_profile_id THEN
      SELECT agent_table_id INTO v_agent_table_id
      FROM profiles
      WHERE id = NEW.assigned_to;
    END IF;
    
    -- If still no agent_table_id linked, skip
    IF v_agent_table_id IS NULL THEN
      RAISE NOTICE 'No agent_table_id for profile % (or assigned_to %), skipping auto-sale', NEW.agent_id, NEW.assigned_to;
      RETURN NEW;
    END IF;
    
    -- Check if sale already exists for this lead (avoid duplicates)
    IF EXISTS (SELECT 1 FROM sales_log WHERE lead_id = NEW.id) THEN
      RAISE NOTICE 'Sale already exists for lead %, skipping', NEW.id;
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
      NEW.service_id,
      COALESCE(v_package_name, 'Fibre Package'),
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

-- The trigger itself doesn't need to be recreated since we're replacing the function
-- But ensure it exists:
DROP TRIGGER IF EXISTS trigger_lead_qualified_sale ON leads;
CREATE TRIGGER trigger_lead_qualified_sale
  AFTER UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION on_lead_qualified_create_sale();
