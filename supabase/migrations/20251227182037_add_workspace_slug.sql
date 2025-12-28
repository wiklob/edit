-- Add slug column to workspaces (idempotent)
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS slug TEXT;

-- Add unique constraint if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workspaces_slug_key') THEN
    ALTER TABLE public.workspaces ADD CONSTRAINT workspaces_slug_key UNIQUE (slug);
  END IF;
END $$;

-- Index for fast slug lookups
CREATE INDEX IF NOT EXISTS idx_workspaces_slug ON public.workspaces(slug);
