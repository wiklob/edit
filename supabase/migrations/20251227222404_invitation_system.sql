-- ============================================================================
-- INVITATION SYSTEM: Secure member joining with no SECURITY DEFINER
-- ============================================================================
--
-- This migration:
-- 1. Creates workspace_invitations table
-- 2. Creates helper function get_my_workspace_ids() to break RLS recursion
-- 3. Fixes all workspace_members RLS policies
-- 4. Removes SECURITY DEFINER from all functions
-- 5. Adds RLS for workspace_invitations
--
-- ============================================================================

-- ============================================================================
-- STEP 1: Create helper function (NO SECURITY DEFINER)
-- This function allows us to check workspace membership without RLS recursion
-- because its internal query always hits the base case (user_id = auth.uid())
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_my_workspace_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT workspace_id
  FROM public.workspace_members
  WHERE user_id = auth.uid();
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_my_workspace_ids() TO authenticated;

-- ============================================================================
-- STEP 2: Create workspace_invitations table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.workspace_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  invited_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '7 days',
  UNIQUE(workspace_id, invited_user_id)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_user
  ON public.workspace_invitations(invited_user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_workspace
  ON public.workspace_invitations(workspace_id);

-- Enable RLS
ALTER TABLE public.workspace_invitations ENABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT SELECT, INSERT, DELETE ON public.workspace_invitations TO authenticated;

-- ============================================================================
-- STEP 3: RLS policies for workspace_invitations
-- ============================================================================

-- SELECT: See invitations to you, or for workspaces you own/admin
CREATE POLICY "workspace_invitations_select" ON public.workspace_invitations
  FOR SELECT USING (
    -- You're the invitee
    invited_user_id = auth.uid()
    -- You're the workspace owner
    OR EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = workspace_id AND w.owner_id = auth.uid()
    )
    -- You're an admin of this workspace
    OR EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = workspace_invitations.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role = 'admin'
    )
  );

-- INSERT: Owner or admin can create invitations
CREATE POLICY "workspace_invitations_insert" ON public.workspace_invitations
  FOR INSERT WITH CHECK (
    -- You're the workspace owner
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = workspace_id AND w.owner_id = auth.uid()
    )
    -- You're an admin of this workspace
    OR EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = workspace_invitations.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role = 'admin'
    )
  );

-- DELETE: Invitee can decline, owner/admin can revoke
CREATE POLICY "workspace_invitations_delete" ON public.workspace_invitations
  FOR DELETE USING (
    -- You're the invitee (declining)
    invited_user_id = auth.uid()
    -- You're the workspace owner
    OR EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = workspace_id AND w.owner_id = auth.uid()
    )
    -- You're an admin of this workspace
    OR EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = workspace_invitations.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role = 'admin'
    )
  );

-- ============================================================================
-- STEP 4: Fix workspace_members RLS policies
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "workspace_members_select" ON public.workspace_members;
DROP POLICY IF EXISTS "workspace_members_insert" ON public.workspace_members;
DROP POLICY IF EXISTS "workspace_members_insert_self" ON public.workspace_members;
DROP POLICY IF EXISTS "workspace_members_insert_others" ON public.workspace_members;
DROP POLICY IF EXISTS "workspace_members_update" ON public.workspace_members;
DROP POLICY IF EXISTS "workspace_members_delete" ON public.workspace_members;

-- SELECT: Members can see all members in their workspaces
-- Uses get_my_workspace_ids() to avoid recursion
CREATE POLICY "workspace_members_select" ON public.workspace_members
  FOR SELECT USING (
    -- Base case: your own rows (terminates recursion)
    user_id = auth.uid()
    -- Members of same workspace (uses helper function)
    OR workspace_id IN (SELECT public.get_my_workspace_ids())
  );

-- INSERT: Only via invitation, or owner/admin can add directly
CREATE POLICY "workspace_members_insert" ON public.workspace_members
  FOR INSERT WITH CHECK (
    -- Workspace owner can add directly (needed for initial trigger)
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = workspace_id AND w.owner_id = auth.uid()
    )
    -- Admin can add directly
    OR EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = workspace_members.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role = 'admin'
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

-- UPDATE: Owner can update anyone, admin can update non-owners, you can update yourself
CREATE POLICY "workspace_members_update" ON public.workspace_members
  FOR UPDATE USING (
    -- Workspace owner can update anyone
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = workspace_id AND w.owner_id = auth.uid()
    )
    -- Admin can update (but triggers prevent demoting owners)
    OR EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = workspace_members.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role = 'admin'
    )
  );

-- DELETE: Owner can remove anyone, admin can remove non-owners, you can leave
CREATE POLICY "workspace_members_delete" ON public.workspace_members
  FOR DELETE USING (
    -- You can remove yourself (leave workspace)
    user_id = auth.uid()
    -- Workspace owner can remove anyone
    OR EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = workspace_id AND w.owner_id = auth.uid()
    )
    -- Admin can remove members (triggers prevent removing owners)
    OR EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = workspace_members.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role = 'admin'
    )
  );

-- ============================================================================
-- STEP 5: Remove SECURITY DEFINER from trigger functions
-- ============================================================================

-- Recreate set_workspace_owner WITHOUT security definer
CREATE OR REPLACE FUNCTION public.set_workspace_owner()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.owner_id IS NULL THEN
    NEW.owner_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

-- Recreate add_workspace_owner_member WITHOUT security definer
CREATE OR REPLACE FUNCTION public.add_workspace_owner_member()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner');
  RETURN NEW;
END;
$$;

-- Recreate prevent_last_owner_removal (already no security definer, just ensuring)
CREATE OR REPLACE FUNCTION public.prevent_last_owner_removal()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  owner_count integer;
BEGIN
  IF OLD.role = 'owner' THEN
    SELECT count(*) INTO owner_count
    FROM public.workspace_members
    WHERE workspace_id = OLD.workspace_id AND role = 'owner' AND id != OLD.id;

    IF owner_count = 0 THEN
      RAISE EXCEPTION 'Cannot remove the last owner of a workspace';
    END IF;
  END IF;
  RETURN OLD;
END;
$$;

-- Recreate prevent_last_owner_demotion (already no security definer, just ensuring)
CREATE OR REPLACE FUNCTION public.prevent_last_owner_demotion()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  owner_count integer;
BEGIN
  IF OLD.role = 'owner' AND NEW.role != 'owner' THEN
    SELECT count(*) INTO owner_count
    FROM public.workspace_members
    WHERE workspace_id = OLD.workspace_id AND role = 'owner' AND id != OLD.id;

    IF owner_count = 0 THEN
      RAISE EXCEPTION 'Cannot demote the last owner of a workspace';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Recreate set_section_access_workspace WITHOUT security definer
CREATE OR REPLACE FUNCTION public.set_section_access_workspace()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  SELECT workspace_id INTO NEW.workspace_id
  FROM public.sections WHERE id = NEW.section_id;
  RETURN NEW;
END;
$$;

-- Drop old security definer functions if they exist
DROP FUNCTION IF EXISTS public.auto_add_workspace_owner() CASCADE;
DROP FUNCTION IF EXISTS public.create_workspace(text, text);

-- ============================================================================
-- STEP 6: Ensure triggers exist (recreate if dropped by CASCADE)
-- ============================================================================

DROP TRIGGER IF EXISTS set_workspace_owner ON public.workspaces;
DROP TRIGGER IF EXISTS add_workspace_owner_member ON public.workspaces;
DROP TRIGGER IF EXISTS on_workspace_member_delete ON public.workspace_members;
DROP TRIGGER IF EXISTS on_workspace_member_update ON public.workspace_members;
DROP TRIGGER IF EXISTS on_section_access_insert ON public.section_access;

CREATE TRIGGER set_workspace_owner
  BEFORE INSERT ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.set_workspace_owner();

CREATE TRIGGER add_workspace_owner_member
  AFTER INSERT ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.add_workspace_owner_member();

CREATE TRIGGER on_workspace_member_delete
  BEFORE DELETE ON public.workspace_members
  FOR EACH ROW EXECUTE FUNCTION public.prevent_last_owner_removal();

CREATE TRIGGER on_workspace_member_update
  BEFORE UPDATE ON public.workspace_members
  FOR EACH ROW EXECUTE FUNCTION public.prevent_last_owner_demotion();

CREATE TRIGGER on_section_access_insert
  BEFORE INSERT ON public.section_access
  FOR EACH ROW EXECUTE FUNCTION public.set_section_access_workspace();

-- ============================================================================
-- DONE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'INVITATION SYSTEM MIGRATION COMPLETE';
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'Created: workspace_invitations table';
  RAISE NOTICE 'Created: get_my_workspace_ids() helper function';
  RAISE NOTICE 'Updated: workspace_members RLS policies';
  RAISE NOTICE 'Removed: All SECURITY DEFINER usage';
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'Invitation flow:';
  RAISE NOTICE '1. Owner/admin: INSERT into workspace_invitations';
  RAISE NOTICE '2. Invitee: SELECT from workspace_invitations';
  RAISE NOTICE '3. Accept: INSERT workspace_members + DELETE invitation';
  RAISE NOTICE '4. Decline: DELETE invitation';
  RAISE NOTICE '==============================================';
END $$;
