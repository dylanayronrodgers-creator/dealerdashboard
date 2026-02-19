-- Fix sales_log entries that have lead_id as account_number instead of order_number
-- This updates any AUTO_LEAD sales where the lead now has an order_number
-- Run in Supabase SQL Editor

UPDATE sales_log sl
SET account_number = l.order_number
FROM leads l
WHERE sl.lead_id = l.id
  AND l.order_number IS NOT NULL
  AND sl.import_source = 'AUTO_LEAD'
  AND (sl.account_number LIKE 'LEAD-%' OR sl.account_number LIKE 'L%' OR sl.account_number IS NULL);

-- Show what was updated
SELECT sl.id, sl.account_number, sl.lead_id, l.order_number, l.full_name
FROM sales_log sl
JOIN leads l ON sl.lead_id = l.id
WHERE sl.import_source = 'AUTO_LEAD'
ORDER BY sl.created_at DESC
LIMIT 20;
