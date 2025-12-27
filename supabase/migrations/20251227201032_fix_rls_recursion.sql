-- ============================================================================
-- FIX: RLS infinite recursion
--
-- The problem: When workspace_members SELECT policy references workspaces,
-- and workspaces SELECT policy references workspace_members, PostgREST JOINs
-- cause infinite recursion.
--
-- The solution: workspace_members SELECT must NOT reference any other table.
-- ============================================================================

-- Drop and recreate workspace_members SELECT policy with simple check
DROP POLICY IF EXISTS "workspace_members_select" ON public.workspace_members;

CREATE POLICY "workspace_members_select" ON public.workspace_members
  FOR SELECT USING (user_id = auth.uid());
