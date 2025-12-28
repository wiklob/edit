-- ============================================================================
-- DEFAULT SECTIONS: Create Editorial, Creative, Management for each workspace
-- ============================================================================

-- ============================================================================
-- STEP 1: Add display_order column for section ordering
-- ============================================================================

ALTER TABLE public.sections
ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;

-- ============================================================================
-- STEP 2: Function to create default sections
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_default_sections()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Create default sections for new workspace
  INSERT INTO public.sections (workspace_id, name, display_order)
  VALUES
    (NEW.id, 'Editorial', 1),
    (NEW.id, 'Creative', 2),
    (NEW.id, 'Management', 3);

  RETURN NEW;
END;
$$;

-- ============================================================================
-- STEP 3: Trigger to create default sections after workspace creation
-- ============================================================================

DROP TRIGGER IF EXISTS create_default_sections ON public.workspaces;

CREATE TRIGGER create_default_sections
  AFTER INSERT ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.create_default_sections();

-- ============================================================================
-- STEP 4: Backfill default sections for existing workspaces
-- ============================================================================

INSERT INTO public.sections (workspace_id, name, display_order)
SELECT w.id, s.name, s.display_order
FROM public.workspaces w
CROSS JOIN (
  VALUES ('Editorial', 1), ('Creative', 2), ('Management', 3)
) AS s(name, display_order)
WHERE NOT EXISTS (
  SELECT 1 FROM public.sections sec
  WHERE sec.workspace_id = w.id AND sec.name = s.name
);

-- ============================================================================
-- STEP 5: Update sections RLS policies
-- ============================================================================

DROP POLICY IF EXISTS "sections_select" ON public.sections;
DROP POLICY IF EXISTS "sections_insert" ON public.sections;
DROP POLICY IF EXISTS "sections_update" ON public.sections;
DROP POLICY IF EXISTS "sections_delete" ON public.sections;

-- SELECT: Owner sees all, members see sections they have access to
CREATE POLICY "sections_select" ON public.sections
  FOR SELECT USING (
    -- Workspace owner sees all sections
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = workspace_id AND w.owner_id = auth.uid()
    )
    -- Members with explicit section access
    OR EXISTS (
      SELECT 1 FROM public.section_access sa
      JOIN public.workspace_members wm ON wm.id = sa.member_id
      WHERE sa.section_id = sections.id AND wm.user_id = auth.uid()
    )
  );

-- INSERT: Only owner can create sections
CREATE POLICY "sections_insert" ON public.sections
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = workspace_id AND w.owner_id = auth.uid()
    )
  );

-- UPDATE: Only owner can update sections
CREATE POLICY "sections_update" ON public.sections
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = workspace_id AND w.owner_id = auth.uid()
    )
  );

-- DELETE: Only owner can delete sections
CREATE POLICY "sections_delete" ON public.sections
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = workspace_id AND w.owner_id = auth.uid()
    )
  );

-- ============================================================================
-- STEP 6: Update section_access RLS policies
-- ============================================================================

DROP POLICY IF EXISTS "section_access_select" ON public.section_access;
DROP POLICY IF EXISTS "section_access_insert" ON public.section_access;
DROP POLICY IF EXISTS "section_access_delete" ON public.section_access;

-- SELECT: See your own access or all if owner
CREATE POLICY "section_access_select" ON public.section_access
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.id = member_id AND wm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = workspace_id AND w.owner_id = auth.uid()
    )
  );

-- INSERT: Only owner can grant access
CREATE POLICY "section_access_insert" ON public.section_access
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = workspace_id AND w.owner_id = auth.uid()
    )
  );

-- DELETE: Only owner can revoke access
CREATE POLICY "section_access_delete" ON public.section_access
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = workspace_id AND w.owner_id = auth.uid()
    )
  );

-- ============================================================================
-- DONE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'DEFAULT SECTIONS COMPLETE';
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'Default sections: Editorial, Creative, Management';
  RAISE NOTICE 'Trigger: create_default_sections on workspace insert';
  RAISE NOTICE 'RLS: Owner sees all, members need section_access';
  RAISE NOTICE '==============================================';
END $$;
