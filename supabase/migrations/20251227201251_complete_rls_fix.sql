-- ============================================================================
-- COMPLETE FIX: Add owner_id, triggers, and correct RLS policies
-- ============================================================================

-- ============================================================================
-- 1. Add owner_id column to workspaces (if not exists)
-- ============================================================================
ALTER TABLE public.workspaces
ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id);

-- ============================================================================
-- 2. Create triggers to set owner_id and add to workspace_members
-- ============================================================================

-- BEFORE INSERT: Set owner_id
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

-- Drop old triggers
DROP TRIGGER IF EXISTS on_workspace_created ON public.workspaces;
DROP TRIGGER IF EXISTS set_workspace_owner ON public.workspaces;
DROP TRIGGER IF EXISTS add_workspace_owner_member ON public.workspaces;

-- Create new triggers
CREATE TRIGGER set_workspace_owner
  BEFORE INSERT ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.set_workspace_owner();

CREATE TRIGGER add_workspace_owner_member
  AFTER INSERT ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.add_workspace_owner_member();

-- ============================================================================
-- 3. Fix workspaces RLS policies
-- ============================================================================
DROP POLICY IF EXISTS "workspaces_insert" ON public.workspaces;
DROP POLICY IF EXISTS "workspaces_select" ON public.workspaces;
DROP POLICY IF EXISTS "workspaces_update" ON public.workspaces;
DROP POLICY IF EXISTS "workspaces_delete" ON public.workspaces;

-- INSERT: Anyone authenticated can create
CREATE POLICY "workspaces_insert" ON public.workspaces
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- SELECT: Owner OR member can see
CREATE POLICY "workspaces_select" ON public.workspaces
  FOR SELECT USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = id AND wm.user_id = auth.uid()
    )
  );

-- UPDATE: Owner or admin
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

-- DELETE: Only owner
CREATE POLICY "workspaces_delete" ON public.workspaces
  FOR DELETE USING (owner_id = auth.uid());

-- ============================================================================
-- 4. Fix workspace_members RLS policies (no cross-table SELECT reference!)
-- ============================================================================
DROP POLICY IF EXISTS "workspace_members_select" ON public.workspace_members;
DROP POLICY IF EXISTS "workspace_members_insert" ON public.workspace_members;
DROP POLICY IF EXISTS "workspace_members_insert_self" ON public.workspace_members;
DROP POLICY IF EXISTS "workspace_members_insert_others" ON public.workspace_members;
DROP POLICY IF EXISTS "workspace_members_update" ON public.workspace_members;
DROP POLICY IF EXISTS "workspace_members_delete" ON public.workspace_members;

-- SELECT: Simple - only your own memberships (avoids recursion!)
CREATE POLICY "workspace_members_select" ON public.workspace_members
  FOR SELECT USING (user_id = auth.uid());

-- INSERT: You can add yourself, or owner can add anyone
CREATE POLICY "workspace_members_insert" ON public.workspace_members
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = workspace_id AND w.owner_id = auth.uid()
    )
  );

-- UPDATE: You or owner
CREATE POLICY "workspace_members_update" ON public.workspace_members
  FOR UPDATE USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = workspace_id AND w.owner_id = auth.uid()
    )
  );

-- DELETE: You or owner
CREATE POLICY "workspace_members_delete" ON public.workspace_members
  FOR DELETE USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = workspace_id AND w.owner_id = auth.uid()
    )
  );

-- ============================================================================
-- 5. Backfill owner_id for existing workspaces
-- ============================================================================
UPDATE public.workspaces w
SET owner_id = (
  SELECT wm.user_id
  FROM public.workspace_members wm
  WHERE wm.workspace_id = w.id AND wm.role = 'owner'
  LIMIT 1
)
WHERE w.owner_id IS NULL;

-- ============================================================================
-- Done
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE 'RLS fix complete: owner_id column, triggers, and policies configured';
END $$;
