-- ============================================================================
-- FIX: Proper RLS without SECURITY DEFINER
--
-- KEY INSIGHT: Self-referential policies on workspace_members cause infinite
-- recursion in Supabase. The solution is to add owner_id to workspaces table
-- to break the circular dependency.
--
-- With owner_id on workspaces:
-- - workspace_members policies can check workspaces.owner_id (no recursion)
-- - workspaces policies can check workspace_members (no recursion)
-- ============================================================================

-- Drop the SECURITY DEFINER RPC function and old trigger function
DROP FUNCTION IF EXISTS public.create_workspace(text, text);
DROP FUNCTION IF EXISTS public.handle_new_workspace();

-- ============================================================================
-- Add owner_id to workspaces (breaks the circular dependency)
-- ============================================================================
ALTER TABLE public.workspaces
ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id);

-- Backfill owner_id from existing workspace_members
UPDATE public.workspaces w
SET owner_id = (
  SELECT wm.user_id
  FROM public.workspace_members wm
  WHERE wm.workspace_id = w.id AND wm.role = 'owner'
  LIMIT 1
)
WHERE w.owner_id IS NULL;

-- ============================================================================
-- Triggers: Split into BEFORE (set owner_id) and AFTER (add to members)
-- NO SECURITY DEFINER needed!
-- ============================================================================

-- BEFORE INSERT: Set owner_id on the workspace
CREATE OR REPLACE FUNCTION public.set_workspace_owner()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Set the owner_id if not already set
  IF NEW.owner_id IS NULL THEN
    NEW.owner_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

-- AFTER INSERT: Add owner to workspace_members
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

DROP TRIGGER IF EXISTS on_workspace_created ON public.workspaces;
DROP TRIGGER IF EXISTS set_workspace_owner ON public.workspaces;
DROP TRIGGER IF EXISTS add_workspace_owner_member ON public.workspaces;

-- BEFORE: Set owner_id
CREATE TRIGGER set_workspace_owner
  BEFORE INSERT ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.set_workspace_owner();

-- AFTER: Add to members table
CREATE TRIGGER add_workspace_owner_member
  AFTER INSERT ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.add_workspace_owner_member();

-- ============================================================================
-- WORKSPACES: Update policies (already has RLS enabled)
-- ============================================================================
DROP POLICY IF EXISTS "workspaces_insert" ON public.workspaces;
DROP POLICY IF EXISTS "workspaces_select" ON public.workspaces;
DROP POLICY IF EXISTS "workspaces_update" ON public.workspaces;
DROP POLICY IF EXISTS "workspaces_delete" ON public.workspaces;

-- INSERT: Anyone can create, but owner_id will be set by trigger
CREATE POLICY "workspaces_insert" ON public.workspaces
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- SELECT: Owner always sees their workspaces, plus any you're a member of
CREATE POLICY "workspaces_select" ON public.workspaces
  FOR SELECT USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = id AND wm.user_id = auth.uid()
    )
  );

-- UPDATE: Owner or admin can update
CREATE POLICY "workspaces_update" ON public.workspaces
  FOR UPDATE USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = id
        AND wm.user_id = auth.uid()
        AND wm.role = 'admin'
    )
  );

-- DELETE: Only owner can delete
CREATE POLICY "workspaces_delete" ON public.workspaces
  FOR DELETE USING (owner_id = auth.uid());

-- ============================================================================
-- WORKSPACE_MEMBERS: Enable RLS with non-recursive policies
-- CRITICAL: SELECT policy must NOT reference other tables to avoid recursion
-- when PostgREST does JOINs
-- ============================================================================
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workspace_members_select" ON public.workspace_members;
DROP POLICY IF EXISTS "workspace_members_insert" ON public.workspace_members;
DROP POLICY IF EXISTS "workspace_members_insert_self" ON public.workspace_members;
DROP POLICY IF EXISTS "workspace_members_insert_others" ON public.workspace_members;
DROP POLICY IF EXISTS "workspace_members_update" ON public.workspace_members;
DROP POLICY IF EXISTS "workspace_members_delete" ON public.workspace_members;

-- SELECT: ONLY check own columns - no external table references!
-- You can see your own memberships (sufficient for workspace list)
CREATE POLICY "workspace_members_select" ON public.workspace_members
  FOR SELECT USING (user_id = auth.uid());

-- INSERT: Workspace owner can add members, or you can add yourself
-- (INSERT/UPDATE/DELETE can check workspaces since they don't cause
-- the same recursive JOIN issue as SELECT)
CREATE POLICY "workspace_members_insert" ON public.workspace_members
  FOR INSERT WITH CHECK (
    -- You can add yourself (for trigger and invites)
    user_id = auth.uid()
    -- Workspace owner can add anyone
    OR EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = workspace_id AND w.owner_id = auth.uid()
    )
  );

-- UPDATE: You can update yourself, or workspace owner can update anyone
CREATE POLICY "workspace_members_update" ON public.workspace_members
  FOR UPDATE USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = workspace_id AND w.owner_id = auth.uid()
    )
  );

-- DELETE: You can remove yourself, or workspace owner can remove anyone
CREATE POLICY "workspace_members_delete" ON public.workspace_members
  FOR DELETE USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = workspace_id AND w.owner_id = auth.uid()
    )
  );

-- ============================================================================
-- SECTION_ACCESS: Enable RLS
-- ============================================================================
ALTER TABLE public.section_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "section_access_select" ON public.section_access;
DROP POLICY IF EXISTS "section_access_insert" ON public.section_access;
DROP POLICY IF EXISTS "section_access_delete" ON public.section_access;

-- SELECT: Workspace owner or members can see
CREATE POLICY "section_access_select" ON public.section_access
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = workspace_id AND w.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = workspace_id AND wm.user_id = auth.uid()
    )
  );

-- INSERT: Workspace owner can manage section access
CREATE POLICY "section_access_insert" ON public.section_access
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = workspace_id AND w.owner_id = auth.uid()
    )
  );

-- DELETE: Workspace owner can manage section access
CREATE POLICY "section_access_delete" ON public.section_access
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = workspace_id AND w.owner_id = auth.uid()
    )
  );

-- ============================================================================
-- Verify
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'RLS FIX COMPLETE';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Added owner_id to workspaces (breaks circular dependency)';
  RAISE NOTICE 'workspace_members: RLS ENABLED - no self-reference!';
  RAISE NOTICE 'section_access: RLS ENABLED';
  RAISE NOTICE 'NO SECURITY DEFINER used anywhere';
  RAISE NOTICE '========================================';
END $$;
