-- Add icon column to sections table
ALTER TABLE public.sections ADD COLUMN IF NOT EXISTS icon TEXT;
