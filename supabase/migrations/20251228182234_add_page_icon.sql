-- Add icon column to pages table
ALTER TABLE public.pages ADD COLUMN IF NOT EXISTS icon TEXT;
