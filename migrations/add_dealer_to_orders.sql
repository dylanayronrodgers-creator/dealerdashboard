-- Add dealer_id column to orders table
-- This allows orders to be associated with dealers directly

-- Add the column (nullable initially to allow existing records)
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS dealer_id UUID REFERENCES dealers(id);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_orders_dealer_id ON orders(dealer_id);

-- Update existing orders to set dealer_id from their associated lead
UPDATE orders o
SET dealer_id = l.dealer_id
FROM leads l
WHERE o.lead_id = l.id
  AND o.dealer_id IS NULL
  AND l.dealer_id IS NOT NULL;

-- Add comment
COMMENT ON COLUMN orders.dealer_id IS 'Reference to the dealer associated with this order';
