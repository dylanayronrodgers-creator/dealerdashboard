-- Add is_preorder field to leads table
-- This allows marking leads as preorders for tracking purposes

-- Add the column (default to false for existing records)
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS is_preorder BOOLEAN DEFAULT false;

-- Create index for better query performance when filtering preorders
CREATE INDEX IF NOT EXISTS idx_leads_is_preorder ON leads(is_preorder);

-- Add comment
COMMENT ON COLUMN leads.is_preorder IS 'Indicates if this lead is a preorder';
