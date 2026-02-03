-- Add logo_url column to dealers table
ALTER TABLE dealers ADD COLUMN IF NOT EXISTS logo_url TEXT;
