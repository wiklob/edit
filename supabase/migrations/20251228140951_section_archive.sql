-- ============================================================================
-- SECTION ARCHIVE: Add is_archived column for soft-delete
-- ============================================================================

ALTER TABLE public.sections
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false;

-- Index for filtering archived sections
CREATE INDEX IF NOT EXISTS idx_sections_archived
  ON public.sections(workspace_id, is_archived);

DO $$
BEGIN
  RAISE NOTICE 'Added is_archived column to sections table';
END $$;
