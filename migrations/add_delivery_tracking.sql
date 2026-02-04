-- Migration: Add delivery tracking fields for free router deliveries
-- Run this in your Supabase SQL Editor

-- Add delivery tracking columns to leads table
ALTER TABLE leads ADD COLUMN IF NOT EXISTS requires_router_delivery BOOLEAN DEFAULT false;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS delivery_requested BOOLEAN DEFAULT false;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS delivery_requested_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS delivery_requested_by UUID REFERENCES auth.users(id);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS delivery_notes TEXT;

-- Create index for faster delivery queries
CREATE INDEX IF NOT EXISTS idx_leads_requires_delivery ON leads(requires_router_delivery) WHERE requires_router_delivery = true;
CREATE INDEX IF NOT EXISTS idx_leads_delivery_requested ON leads(delivery_requested) WHERE delivery_requested = false;

-- Add comments
COMMENT ON COLUMN leads.requires_router_delivery IS 'Whether this lead requires a free router delivery (non-webconnect, non-prepaid packages)';
COMMENT ON COLUMN leads.delivery_requested IS 'Whether the free router delivery has been requested';
COMMENT ON COLUMN leads.delivery_requested_at IS 'Timestamp when delivery was requested';
COMMENT ON COLUMN leads.delivery_requested_by IS 'User who requested the delivery';
COMMENT ON COLUMN leads.delivery_notes IS 'Notes about the delivery request';
