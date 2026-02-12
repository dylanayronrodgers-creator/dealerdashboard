-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- Adds payment tracking columns to the orders table

ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'unpaid';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_due_date timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_amount numeric DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_date timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_reminder_sent boolean DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_notes text;

-- Update RLS policy to allow reading/writing payment fields
-- (existing policies should cover this since they apply to the whole row)
