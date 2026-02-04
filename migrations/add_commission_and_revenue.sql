-- Migration: Add Commission Structure and Revenue Tracking
-- Run this in Supabase SQL Editor

-- ============================================
-- 1. UPDATE PACKAGES TABLE FOR COMMISSION
-- ============================================
ALTER TABLE packages ADD COLUMN IF NOT EXISTS product_type TEXT DEFAULT 'fibre' CHECK (product_type IN ('fibre', 'prepaid'));
ALTER TABLE packages ADD COLUMN IF NOT EXISTS dealer_commission DECIMAL(10,2) DEFAULT 200.00;
ALTER TABLE packages ADD COLUMN IF NOT EXISTS agent_commission DECIMAL(10,2) DEFAULT 0.00;
ALTER TABLE packages ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Update existing packages with fibre commission
UPDATE packages SET product_type = 'fibre', dealer_commission = 200.00 WHERE product_type IS NULL OR product_type = 'fibre';

-- ============================================
-- 2. ADD INTERNAL SALES TEAM SUPPORT
-- ============================================
-- Add team_type to profiles (dealer_agent or internal)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS team_type TEXT DEFAULT 'dealer_agent' CHECK (team_type IN ('dealer_agent', 'internal'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS commission_rate DECIMAL(5,2) DEFAULT 0.00;

-- ============================================
-- 3. ADD LEAD STATUS FOR REVENUE TRACKING
-- ============================================
-- Add commission_status to track payment status
ALTER TABLE leads ADD COLUMN IF NOT EXISTS commission_status TEXT DEFAULT 'pending' CHECK (commission_status IN ('pending', 'confirmed', 'paid', 'rejected'));
ALTER TABLE leads ADD COLUMN IF NOT EXISTS commission_amount DECIMAL(10,2) DEFAULT 0.00;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- ============================================
-- 4. CREATE AGGREGATED VIEWS FOR MINIMAL REQUESTS
-- ============================================

-- Dealer Revenue Summary View
CREATE OR REPLACE VIEW dealer_revenue_summary AS
SELECT 
    d.id as dealer_id,
    d.name as dealer_name,
    COUNT(CASE WHEN l.commission_status = 'confirmed' OR l.commission_status = 'paid' THEN 1 END) as confirmed_count,
    COUNT(CASE WHEN l.commission_status = 'pending' THEN 1 END) as pending_count,
    COUNT(CASE WHEN l.commission_status = 'rejected' THEN 1 END) as rejected_count,
    COUNT(l.id) as total_leads,
    COALESCE(SUM(CASE WHEN l.commission_status = 'confirmed' OR l.commission_status = 'paid' THEN COALESCE(l.commission_amount, p.dealer_commission, 200) ELSE 0 END), 0) as confirmed_revenue,
    COALESCE(SUM(CASE WHEN l.commission_status = 'pending' THEN COALESCE(p.dealer_commission, 200) ELSE 0 END), 0) as pending_revenue,
    COALESCE(SUM(CASE WHEN l.commission_status = 'rejected' THEN COALESCE(p.dealer_commission, 200) ELSE 0 END), 0) as rejected_revenue
FROM dealers d
LEFT JOIN leads l ON l.dealer_id = d.id
LEFT JOIN packages p ON l.package_id = p.id
WHERE d.is_active = true
GROUP BY d.id, d.name;

-- Agent Performance Summary View
CREATE OR REPLACE VIEW agent_performance_summary AS
SELECT 
    pr.id as agent_id,
    pr.full_name as agent_name,
    pr.dealer_id,
    d.name as dealer_name,
    pr.team_type,
    COUNT(CASE WHEN l.commission_status = 'confirmed' OR l.commission_status = 'paid' THEN 1 END) as confirmed_count,
    COUNT(CASE WHEN l.commission_status = 'pending' THEN 1 END) as pending_count,
    COUNT(CASE WHEN l.commission_status = 'rejected' THEN 1 END) as rejected_count,
    COUNT(l.id) as total_leads,
    COALESCE(SUM(CASE WHEN l.commission_status = 'confirmed' OR l.commission_status = 'paid' THEN pr.commission_rate ELSE 0 END), 0) as earned_commission
FROM profiles pr
LEFT JOIN leads l ON l.agent_id = pr.id
LEFT JOIN dealers d ON pr.dealer_id = d.id
WHERE pr.role = 'agent'
GROUP BY pr.id, pr.full_name, pr.dealer_id, d.name, pr.team_type;

-- Dashboard Stats View (single query for all stats)
CREATE OR REPLACE VIEW dashboard_stats AS
SELECT
    (SELECT COUNT(*) FROM leads WHERE status != 'converted') as total_leads,
    (SELECT COUNT(*) FROM leads WHERE commission_status = 'pending') as pending_leads,
    (SELECT COUNT(*) FROM leads WHERE commission_status = 'confirmed' OR commission_status = 'paid') as confirmed_leads,
    (SELECT COUNT(*) FROM leads WHERE commission_status = 'rejected') as rejected_leads,
    (SELECT COUNT(*) FROM orders WHERE status NOT IN ('completed', 'cancelled')) as active_orders,
    (SELECT COUNT(*) FROM orders WHERE status = 'completed') as completed_orders,
    (SELECT COUNT(*) FROM profiles WHERE role = 'agent') as total_agents,
    (SELECT COUNT(*) FROM dealers WHERE is_active = true) as active_dealers,
    (SELECT COALESCE(SUM(CASE WHEN l.commission_status IN ('confirmed', 'paid') THEN COALESCE(l.commission_amount, p.dealer_commission, 200) ELSE 0 END), 0) 
     FROM leads l LEFT JOIN packages p ON l.package_id = p.id) as total_confirmed_revenue,
    (SELECT COALESCE(SUM(COALESCE(p.dealer_commission, 200)), 0) 
     FROM leads l LEFT JOIN packages p ON l.package_id = p.id WHERE l.commission_status = 'pending') as total_pending_revenue;

-- ============================================
-- 5. CREATE FUNCTION TO CONFIRM LEAD AND CALCULATE COMMISSION
-- ============================================
DROP FUNCTION IF EXISTS confirm_lead(uuid);
DROP FUNCTION IF EXISTS reject_lead(uuid, text);

CREATE OR REPLACE FUNCTION confirm_lead(p_lead_id UUID)
RETURNS void AS $func$
DECLARE
    pkg_commission DECIMAL(10,2);
BEGIN
    SELECT COALESCE(p.dealer_commission, 200.00) INTO pkg_commission
    FROM leads l LEFT JOIN packages p ON l.package_id = p.id
    WHERE l.id = p_lead_id;
    
    UPDATE leads SET
        commission_status = 'confirmed',
        commission_amount = pkg_commission,
        confirmed_at = NOW(),
        status = 'converted'
    WHERE id = p_lead_id;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION reject_lead(p_lead_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS void AS $func$
BEGIN
    UPDATE leads SET
        commission_status = 'rejected',
        rejected_at = NOW(),
        rejection_reason = p_reason,
        status = 'lost'
    WHERE id = p_lead_id;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 6. GRANT ACCESS TO VIEWS
-- ============================================
GRANT SELECT ON dealer_revenue_summary TO authenticated;
GRANT SELECT ON agent_performance_summary TO authenticated;
GRANT SELECT ON dashboard_stats TO authenticated;

-- ============================================
-- 7. ADD SAMPLE PREPAID PACKAGE (inactive until ready)
-- ============================================
-- Note: Prepaid package disabled until fully implemented
-- INSERT INTO packages (name, speed, price, description, product_type, dealer_commission, is_active) VALUES
--     ('Prepaid Fibre - TBD', 0, 0, 'Prepaid fibre product (coming soon)', 'prepaid', 100.00, false)
-- ON CONFLICT DO NOTHING;
