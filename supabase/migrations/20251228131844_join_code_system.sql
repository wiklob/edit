-- ============================================================================
-- JOIN CODE SYSTEM: Replace invitations with shareable codes + approval
-- ============================================================================
--
-- Flow:
-- 1. Workspace has a 7-digit join code (generated on creation)
-- 2. User enters code → creates a join request (pending)
-- 3. Owner approves/rejects → if approved, user becomes member
-- 4. Owner can rotate code at any time
--
-- ============================================================================

-- ============================================================================
-- STEP 1: Drop the invitation system
-- ============================================================================

DROP TABLE IF EXISTS public.workspace_invitations CASCADE;
DROP FUNCTION IF EXISTS public.get_my_workspace_ids() CASCADE;

-- ============================================================================
-- STEP 2: Add join_code to workspaces
-- ============================================================================

ALTER TABLE public.workspaces
ADD COLUMN IF NOT EXISTS join_code TEXT UNIQUE;

-- ============================================================================
-- STEP 3: Function to generate 7-digit code
-- ============================================================================

CREATE OR REPLACE FUNCTION public.generate_join_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate random 7-digit number (1000000-9999999)
    new_code := LPAD(FLOOR(RANDOM() * 9000000 + 1000000)::TEXT, 7, '0');

    -- Check if code already exists
    SELECT EXISTS(SELECT 1 FROM public.workspaces WHERE join_code = new_code) INTO code_exists;

    -- Exit loop if code is unique
    EXIT WHEN NOT code_exists;
  END LOOP;

  RETURN new_code;
END;
$$;

-- ============================================================================
-- STEP 4: Trigger to set join_code on workspace creation
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_workspace_join_code()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.join_code IS NULL THEN
    NEW.join_code := public.generate_join_code();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_workspace_join_code ON public.workspaces;

CREATE TRIGGER set_workspace_join_code
  BEFORE INSERT ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.set_workspace_join_code();

-- Backfill existing workspaces without join codes
UPDATE public.workspaces
SET join_code = public.generate_join_code()
WHERE join_code IS NULL;

-- ============================================================================
-- STEP 5: Create join_requests table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.workspace_join_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id),
  UNIQUE(workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_join_requests_workspace ON public.workspace_join_requests(workspace_id);
CREATE INDEX IF NOT EXISTS idx_join_requests_user ON public.workspace_join_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_join_requests_status ON public.workspace_join_requests(status);

ALTER TABLE public.workspace_join_requests ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_join_requests TO authenticated;

-- ============================================================================
-- STEP 6: RLS for join_requests
-- ============================================================================

-- SELECT: See your own requests, or all requests if you're the workspace owner
CREATE POLICY "join_requests_select" ON public.workspace_join_requests
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = workspace_id AND w.owner_id = auth.uid()
    )
  );

-- INSERT: Anyone can create a request for themselves
CREATE POLICY "join_requests_insert" ON public.workspace_join_requests
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND status = 'pending'
  );

-- UPDATE: Only workspace owner can approve/reject
CREATE POLICY "join_requests_update" ON public.workspace_join_requests
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = workspace_id AND w.owner_id = auth.uid()
    )
  );

-- DELETE: Requester can cancel, owner can delete
CREATE POLICY "join_requests_delete" ON public.workspace_join_requests
  FOR DELETE USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = workspace_id AND w.owner_id = auth.uid()
    )
  );

-- ============================================================================
-- STEP 7: Function to request joining with a code
-- ============================================================================

CREATE OR REPLACE FUNCTION public.request_to_join(p_join_code TEXT)
RETURNS public.workspace_join_requests
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_workspace_id UUID;
  v_user_id UUID;
  v_existing_member BOOLEAN;
  v_existing_request public.workspace_join_requests;
  v_new_request public.workspace_join_requests;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Find workspace by code
  SELECT id INTO v_workspace_id
  FROM public.workspaces
  WHERE join_code = p_join_code;

  IF v_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Invalid join code';
  END IF;

  -- Check if already a member
  SELECT EXISTS(
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = v_workspace_id AND user_id = v_user_id
  ) INTO v_existing_member;

  IF v_existing_member THEN
    RAISE EXCEPTION 'Already a member of this workspace';
  END IF;

  -- Check for existing pending request
  SELECT * INTO v_existing_request
  FROM public.workspace_join_requests
  WHERE workspace_id = v_workspace_id AND user_id = v_user_id;

  IF v_existing_request IS NOT NULL THEN
    IF v_existing_request.status = 'pending' THEN
      RAISE EXCEPTION 'Request already pending';
    ELSIF v_existing_request.status = 'rejected' THEN
      -- Allow re-requesting if previously rejected (delete old request)
      DELETE FROM public.workspace_join_requests WHERE id = v_existing_request.id;
    END IF;
  END IF;

  -- Create the request
  INSERT INTO public.workspace_join_requests (workspace_id, user_id, status)
  VALUES (v_workspace_id, v_user_id, 'pending')
  RETURNING * INTO v_new_request;

  RETURN v_new_request;
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_to_join(TEXT) TO authenticated;

-- ============================================================================
-- STEP 8: Function to approve a join request
-- ============================================================================

CREATE OR REPLACE FUNCTION public.approve_join_request(p_request_id UUID)
RETURNS public.workspace_members
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_request public.workspace_join_requests;
  v_user_id UUID;
  v_new_member public.workspace_members;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get the request
  SELECT * INTO v_request
  FROM public.workspace_join_requests
  WHERE id = p_request_id;

  IF v_request IS NULL THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  IF v_request.status != 'pending' THEN
    RAISE EXCEPTION 'Request already processed';
  END IF;

  -- Verify caller is workspace owner
  IF NOT EXISTS (
    SELECT 1 FROM public.workspaces
    WHERE id = v_request.workspace_id AND owner_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Only workspace owner can approve requests';
  END IF;

  -- Update request status
  UPDATE public.workspace_join_requests
  SET status = 'approved', reviewed_at = now(), reviewed_by = v_user_id
  WHERE id = p_request_id;

  -- Add user as member
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (v_request.workspace_id, v_request.user_id, 'member')
  RETURNING * INTO v_new_member;

  RETURN v_new_member;
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_join_request(UUID) TO authenticated;

-- ============================================================================
-- STEP 9: Function to reject a join request
-- ============================================================================

CREATE OR REPLACE FUNCTION public.reject_join_request(p_request_id UUID)
RETURNS public.workspace_join_requests
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_request public.workspace_join_requests;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get the request
  SELECT * INTO v_request
  FROM public.workspace_join_requests
  WHERE id = p_request_id;

  IF v_request IS NULL THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  IF v_request.status != 'pending' THEN
    RAISE EXCEPTION 'Request already processed';
  END IF;

  -- Verify caller is workspace owner
  IF NOT EXISTS (
    SELECT 1 FROM public.workspaces
    WHERE id = v_request.workspace_id AND owner_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Only workspace owner can reject requests';
  END IF;

  -- Update request status
  UPDATE public.workspace_join_requests
  SET status = 'rejected', reviewed_at = now(), reviewed_by = v_user_id
  WHERE id = p_request_id
  RETURNING * INTO v_request;

  RETURN v_request;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reject_join_request(UUID) TO authenticated;

-- ============================================================================
-- STEP 10: Function to rotate join code (owner only)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rotate_join_code(p_workspace_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_user_id UUID;
  v_new_code TEXT;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Verify caller is workspace owner
  IF NOT EXISTS (
    SELECT 1 FROM public.workspaces
    WHERE id = p_workspace_id AND owner_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Only workspace owner can rotate join code';
  END IF;

  -- Generate and set new code
  v_new_code := public.generate_join_code();

  UPDATE public.workspaces
  SET join_code = v_new_code
  WHERE id = p_workspace_id;

  RETURN v_new_code;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rotate_join_code(UUID) TO authenticated;

-- ============================================================================
-- STEP 11: Update workspace_members policies (remove invitation reference)
-- ============================================================================

DROP POLICY IF EXISTS "workspace_members_insert" ON public.workspace_members;

-- INSERT: Owner can add directly, or approved via function (which runs as invoker)
CREATE POLICY "workspace_members_insert" ON public.workspace_members
  FOR INSERT WITH CHECK (
    -- Workspace owner can add directly
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = workspace_id AND w.owner_id = auth.uid()
    )
  );

-- ============================================================================
-- STEP 12: Recreate helper function for workspace_members SELECT
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

GRANT EXECUTE ON FUNCTION public.get_my_workspace_ids() TO authenticated;

-- ============================================================================
-- DONE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'JOIN CODE SYSTEM COMPLETE';
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'Removed: workspace_invitations table';
  RAISE NOTICE 'Added: join_code column on workspaces';
  RAISE NOTICE 'Added: workspace_join_requests table';
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'Functions:';
  RAISE NOTICE '  - request_to_join(code) → creates pending request';
  RAISE NOTICE '  - approve_join_request(request_id) → approves + adds member';
  RAISE NOTICE '  - reject_join_request(request_id) → rejects request';
  RAISE NOTICE '  - rotate_join_code(workspace_id) → generates new code';
  RAISE NOTICE '==============================================';
END $$;
