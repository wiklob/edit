-- ============================================================================
-- FIX: Add FK from workspace_join_requests to public.users
-- ============================================================================
--
-- Problem: workspace_join_requests.user_id references auth.users, but
-- PostgREST can't join to public.users (where we store user info).
--
-- Solution: Add a foreign key to public.users so PostgREST can find
-- the relationship for joins like `user:users(*)`.
--
-- ============================================================================

-- Add FK to public.users (user_id already references auth.users)
ALTER TABLE public.workspace_join_requests
ADD CONSTRAINT workspace_join_requests_user_id_fkey_public
FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Also add FK for reviewed_by
ALTER TABLE public.workspace_join_requests
ADD CONSTRAINT workspace_join_requests_reviewed_by_fkey_public
FOREIGN KEY (reviewed_by) REFERENCES public.users(id) ON DELETE SET NULL;

DO $$
BEGIN
  RAISE NOTICE 'Added FK from workspace_join_requests to public.users';
END $$;
