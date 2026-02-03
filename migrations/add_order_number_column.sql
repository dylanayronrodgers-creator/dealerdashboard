-- Add order_number column to orders table
-- Order number is manually entered and serves as the primary identifier for orders

ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_number TEXT;

-- Create index for faster lookups by order_number
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);

-- Add unique constraint to prevent duplicate order numbers
ALTER TABLE orders ADD CONSTRAINT orders_order_number_unique UNIQUE (order_number);

COMMENT ON COLUMN orders.order_number IS 'Manually entered order number - primary identifier for orders';
