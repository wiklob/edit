-- ============================================================================
-- FIX: RLS recursion when joining workspace
-- ============================================================================
--
-- Problem: request_to_join() uses SECURITY INVOKER, so when it queries
-- workspaces to find the one with the matching join code, it triggers RLS
-- which calls get_my_workspace_ids(), causing infinite recursion.
--
-- Solution: Make request_to_join() SECURITY DEFINER so it bypasses RLS
-- for its internal queries. The function already validates the user is
-- authenticated and handles all the business logic correctly.
--
-- ============================================================================

CREATE OR REPLACE FUNCTION public.request_to_join(p_join_code TEXT)
RETURNS public.workspace_join_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  -- Find workspace by code (bypasses RLS due to SECURITY DEFINER)
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

-- Also make approve_join_request SECURITY DEFINER for consistency
-- (it needs to access workspaces owned by the approver and add members)
CREATE OR REPLACE FUNCTION public.approve_join_request(p_request_id UUID)
RETURNS public.workspace_members
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- Also make reject_join_request SECURITY DEFINER for consistency
CREATE OR REPLACE FUNCTION public.reject_join_request(p_request_id UUID)
RETURNS public.workspace_join_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

DO $$
BEGIN
  RAISE NOTICE 'Fixed join functions to use SECURITY DEFINER';
END $$;
