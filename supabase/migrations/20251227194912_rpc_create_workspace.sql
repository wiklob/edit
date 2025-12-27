-- ============================================================================
-- RPC FUNCTION: Bypass PostgREST's RLS handling entirely
-- SECURITY DEFINER runs as the function owner (postgres), bypassing RLS
-- ============================================================================

create or replace function public.create_workspace(
  workspace_name text,
  workspace_slug text
)
returns public.workspaces
language plpgsql
security definer
set search_path = public
as $$
declare
  new_workspace public.workspaces;
  current_user_id uuid;
begin
  -- Get the current user's ID
  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Create the workspace
  insert into public.workspaces (name, slug)
  values (workspace_name, workspace_slug)
  returning * into new_workspace;

  -- Add the creator as owner
  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_workspace.id, current_user_id, 'owner');

  return new_workspace;
end;
$$;

-- Grant execute permission
grant execute on function public.create_workspace(text, text) to authenticated;
