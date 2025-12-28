-- ============================================================================
-- FIX: Recreate policies dropped by CASCADE
-- ============================================================================
--
-- The DROP FUNCTION ... CASCADE on get_my_workspace_ids() dropped
-- policies that referenced it. Recreating them here.
--
-- ============================================================================

-- ============================================================================
-- WORKSPACES policies
-- ============================================================================

DROP POLICY IF EXISTS "workspaces_select" ON public.workspaces;
DROP POLICY IF EXISTS "workspaces_insert" ON public.workspaces;
DROP POLICY IF EXISTS "workspaces_update" ON public.workspaces;
DROP POLICY IF EXISTS "workspaces_delete" ON public.workspaces;

-- SELECT: Owner or member
CREATE POLICY "workspaces_select" ON public.workspaces
  FOR SELECT USING (
    owner_id = auth.uid()
    OR id IN (SELECT public.get_my_workspace_ids())
  );

-- INSERT: Any authenticated user can create
CREATE POLICY "workspaces_insert" ON public.workspaces
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- UPDATE: Owner or admin
CREATE POLICY "workspaces_update" ON public.workspaces
  FOR UPDATE USING (
    owner_id = auth.uid()
    OR id IN (
      SELECT workspace_id
      FROM public.workspace_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- DELETE: Owner only
CREATE POLICY "workspaces_delete" ON public.workspaces
  FOR DELETE USING (owner_id = auth.uid());

-- ============================================================================
-- WORKSPACE_MEMBERS policies
-- ============================================================================

DROP POLICY IF EXISTS "workspace_members_select" ON public.workspace_members;
DROP POLICY IF EXISTS "workspace_members_insert" ON public.workspace_members;
DROP POLICY IF EXISTS "workspace_members_update" ON public.workspace_members;
DROP POLICY IF EXISTS "workspace_members_delete" ON public.workspace_members;

-- SELECT: Members can see all members in their workspaces
CREATE POLICY "workspace_members_select" ON public.workspace_members
  FOR SELECT USING (
    user_id = auth.uid()
    OR workspace_id IN (SELECT public.get_my_workspace_ids())
  );

-- INSERT: Owner can add directly (approve function handles join requests)
CREATE POLICY "workspace_members_insert" ON public.workspace_members
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = workspace_id AND w.owner_id = auth.uid()
    )
  );

-- UPDATE: Owner only
CREATE POLICY "workspace_members_update" ON public.workspace_members
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = workspace_id AND w.owner_id = auth.uid()
    )
  );

-- DELETE: Self or owner
CREATE POLICY "workspace_members_delete" ON public.workspace_members
  FOR DELETE USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = workspace_id AND w.owner_id = auth.uid()
    )
  );

-- ============================================================================
-- DONE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Policies recreated for workspaces and workspace_members';
END $$;
