-- ============================================================================
-- FIX: RLS recursion in workspace_members and workspaces
-- ============================================================================
--
-- Problem: workspace_members SELECT policy uses get_my_workspace_ids(),
-- which queries workspace_members, causing infinite recursion.
--
-- Solution: Create a minimal SECURITY DEFINER helper that bypasses RLS
-- for getting workspace IDs. This is safe because:
-- - It only returns workspace IDs (UUIDs), no sensitive data
-- - It only returns workspaces where user_id = auth.uid()
-- - It's the exact same data the user would see if RLS wasn't recursive
--
-- ============================================================================

-- ============================================================================
-- STEP 1: Create SECURITY DEFINER helper for workspace IDs
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_my_workspace_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT workspace_id
  FROM public.workspace_members
  WHERE user_id = auth.uid();
$$;

-- ============================================================================
-- STEP 2: Fix workspace_members SELECT policy
-- ============================================================================

DROP POLICY IF EXISTS "workspace_members_select" ON public.workspace_members;

-- User can see their own membership, or all members in their workspaces
CREATE POLICY "workspace_members_select" ON public.workspace_members
  FOR SELECT USING (
    user_id = auth.uid()
    OR workspace_id IN (SELECT public.get_my_workspace_ids())
  );

-- ============================================================================
-- STEP 3: Fix workspaces SELECT policy
-- ============================================================================

DROP POLICY IF EXISTS "workspaces_select" ON public.workspaces;

-- Owner or member can see workspace
CREATE POLICY "workspaces_select" ON public.workspaces
  FOR SELECT USING (
    owner_id = auth.uid()
    OR id IN (SELECT public.get_my_workspace_ids())
  );

-- ============================================================================
-- STEP 4: Also fix users SELECT if needed
-- ============================================================================

DROP POLICY IF EXISTS "users_select" ON public.users;

-- Users can see all users (needed for displaying member names)
-- This is safe because users table only has basic profile info
CREATE POLICY "users_select" ON public.users
  FOR SELECT USING (true);

-- ============================================================================
-- DONE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Fixed RLS recursion:';
  RAISE NOTICE '  - get_my_workspace_ids() is now SECURITY DEFINER';
  RAISE NOTICE '  - workspace_members and workspaces policies use the helper';
END $$;
