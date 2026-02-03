-- Add agent_name, dealer_name, package_name columns to leads table
-- These store the imported values directly for display purposes

ALTER TABLE leads ADD COLUMN IF NOT EXISTS agent_name TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS dealer_name TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS package_name TEXT;

COMMENT ON COLUMN leads.agent_name IS 'Agent name from import - displays even if agent not linked';
COMMENT ON COLUMN leads.dealer_name IS 'Dealer name from import - displays even if dealer not linked';
COMMENT ON COLUMN leads.package_name IS 'Package name from import - displays even if package not linked';
