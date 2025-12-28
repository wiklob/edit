-- ============================================================================
-- FIX: Join workspace without SECURITY DEFINER on main functions
-- ============================================================================
--
-- Problem: request_to_join() needs to look up workspace by join_code,
-- but user can't see workspaces they're not a member of (RLS).
--
-- Solution: Create a minimal SECURITY DEFINER helper that ONLY returns
-- the workspace_id for a given join code. This is safe because:
-- - It only returns a UUID (no sensitive data)
-- - The join code is meant to be shared anyway
-- - The main functions stay SECURITY INVOKER
--
-- ============================================================================

-- ============================================================================
-- STEP 1: Create minimal lookup helper (SECURITY DEFINER)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_workspace_id_by_join_code(p_join_code TEXT)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT id FROM public.workspaces WHERE join_code = p_join_code LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_workspace_id_by_join_code(TEXT) TO authenticated;

-- ============================================================================
-- STEP 2: Revert request_to_join to SECURITY INVOKER, use helper
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

  -- Find workspace by code using helper (bypasses RLS safely)
  v_workspace_id := public.get_workspace_id_by_join_code(p_join_code);

  IF v_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Invalid join code';
  END IF;

  -- Check if already a member (user can see their own memberships)
  SELECT EXISTS(
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = v_workspace_id AND user_id = v_user_id
  ) INTO v_existing_member;

  IF v_existing_member THEN
    RAISE EXCEPTION 'Already a member of this workspace';
  END IF;

  -- Check for existing request (user can see their own requests)
  SELECT * INTO v_existing_request
  FROM public.workspace_join_requests
  WHERE workspace_id = v_workspace_id AND user_id = v_user_id;

  IF v_existing_request IS NOT NULL THEN
    IF v_existing_request.status = 'pending' THEN
      RAISE EXCEPTION 'Request already pending';
    ELSIF v_existing_request.status = 'rejected' THEN
      -- Allow re-requesting if previously rejected
      DELETE FROM public.workspace_join_requests WHERE id = v_existing_request.id;
    END IF;
  END IF;

  -- Create the request (user can insert their own requests per RLS)
  INSERT INTO public.workspace_join_requests (workspace_id, user_id, status)
  VALUES (v_workspace_id, v_user_id, 'pending')
  RETURNING * INTO v_new_request;

  RETURN v_new_request;
END;
$$;

-- ============================================================================
-- STEP 3: Revert approve_join_request to SECURITY INVOKER
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

  -- Get the request (owner can see requests for their workspaces per RLS)
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

  -- Add user as member (owner can insert per RLS)
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (v_request.workspace_id, v_request.user_id, 'member')
  RETURNING * INTO v_new_member;

  RETURN v_new_member;
END;
$$;

-- ============================================================================
-- STEP 4: Revert reject_join_request to SECURITY INVOKER
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

-- ============================================================================
-- DONE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Fixed join functions:';
  RAISE NOTICE '  - get_workspace_id_by_join_code(): minimal SECURITY DEFINER helper';
  RAISE NOTICE '  - request_to_join(): SECURITY INVOKER, uses helper';
  RAISE NOTICE '  - approve/reject: SECURITY INVOKER';
END $$;
