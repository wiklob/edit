-- ============================================================================
-- FIX: RLS recursion in workspaces SELECT policy
-- ============================================================================
--
-- Problem: workspaces SELECT policy queries workspace_members directly,
-- which triggers workspace_members SELECT policy, which calls get_my_workspace_ids(),
-- which queries workspace_members again → infinite recursion.
--
-- Solution:
-- 1. Update workspaces SELECT to use get_my_workspace_ids() helper
-- 2. Remove admin check from workspace_members INSERT (avoids self-reference)
--
-- ============================================================================

-- ============================================================================
-- STEP 1: Fix workspaces SELECT policy
-- ============================================================================

DROP POLICY IF EXISTS "workspaces_select" ON public.workspaces;

-- Use helper function to avoid recursion
-- The function queries workspace_members with user_id = auth.uid(),
-- which hits the base case in workspace_members SELECT policy
CREATE POLICY "workspaces_select" ON public.workspaces
  FOR SELECT USING (
    owner_id = auth.uid()
    OR id IN (SELECT public.get_my_workspace_ids())
  );

-- ============================================================================
-- STEP 2: Fix workspaces UPDATE policy (same issue)
-- ============================================================================

DROP POLICY IF EXISTS "workspaces_update" ON public.workspaces;

-- Owner or admin can update
-- For admin check, we query workspace_members but filter by auth.uid() first
CREATE POLICY "workspaces_update" ON public.workspaces
  FOR UPDATE USING (
    owner_id = auth.uid()
    OR id IN (
      SELECT workspace_id
      FROM public.workspace_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================================
-- STEP 3: Fix workspace_members INSERT policy
-- Remove the admin self-reference check to avoid recursion
-- Admins must use invitation flow instead of direct add
-- ============================================================================

DROP POLICY IF EXISTS "workspace_members_insert" ON public.workspace_members;

CREATE POLICY "workspace_members_insert" ON public.workspace_members
  FOR INSERT WITH CHECK (
    -- Workspace owner can add directly (for trigger + manual)
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = workspace_id AND w.owner_id = auth.uid()
    )
    -- User accepting an invitation (can only add themselves)
    OR (
      user_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.workspace_invitations wi
        WHERE wi.workspace_id = workspace_members.workspace_id
          AND wi.invited_user_id = auth.uid()
          AND wi.expires_at > now()
      )
    )
  );

-- ============================================================================
-- STEP 4: Fix workspace_members UPDATE policy (same issue)
-- ============================================================================

DROP POLICY IF EXISTS "workspace_members_update" ON public.workspace_members;

CREATE POLICY "workspace_members_update" ON public.workspace_members
  FOR UPDATE USING (
    -- Only workspace owner can update member roles
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = workspace_id AND w.owner_id = auth.uid()
    )
  );

-- ============================================================================
-- STEP 5: Fix workspace_members DELETE policy
-- ============================================================================

DROP POLICY IF EXISTS "workspace_members_delete" ON public.workspace_members;

CREATE POLICY "workspace_members_delete" ON public.workspace_members
  FOR DELETE USING (
    -- You can remove yourself (leave workspace)
    user_id = auth.uid()
    -- Workspace owner can remove anyone
    OR EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = workspace_id AND w.owner_id = auth.uid()
    )
  );

-- ============================================================================
-- STEP 6: Fix workspace_invitations policies (remove admin self-reference)
-- ============================================================================

DROP POLICY IF EXISTS "workspace_invitations_select" ON public.workspace_invitations;
DROP POLICY IF EXISTS "workspace_invitations_insert" ON public.workspace_invitations;
DROP POLICY IF EXISTS "workspace_invitations_delete" ON public.workspace_invitations;

-- SELECT: Invitee or workspace owner
CREATE POLICY "workspace_invitations_select" ON public.workspace_invitations
  FOR SELECT USING (
    invited_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = workspace_id AND w.owner_id = auth.uid()
    )
  );

-- INSERT: Only workspace owner can invite
CREATE POLICY "workspace_invitations_insert" ON public.workspace_invitations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = workspace_id AND w.owner_id = auth.uid()
    )
  );

-- DELETE: Invitee can decline, owner can revoke
CREATE POLICY "workspace_invitations_delete" ON public.workspace_invitations
  FOR DELETE USING (
    invited_user_id = auth.uid()
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
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'RLS RECURSION FIX V2 COMPLETE';
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'Fixed: workspaces SELECT uses get_my_workspace_ids()';
  RAISE NOTICE 'Fixed: workspace_members INSERT no self-reference';
  RAISE NOTICE 'Fixed: workspace_invitations simplified to owner-only';
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'Note: Admins must use invitation flow to add members';
  RAISE NOTICE '==============================================';
END $$;
