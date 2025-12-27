-- ============================================================================
-- FIX: Remove self-referential policy on workspace_members
-- PostgreSQL doesn't short-circuit, so self-referential subqueries cause recursion
-- ============================================================================

-- Drop the problematic policies
drop policy if exists "workspace_members_select" on public.workspace_members;
drop policy if exists "workspace_members_insert" on public.workspace_members;
drop policy if exists "workspace_members_update" on public.workspace_members;
drop policy if exists "workspace_members_delete" on public.workspace_members;

-- Simple SELECT: you can only see your own memberships
-- For owner to see all members, we'll use a function
create policy "workspace_members_select" on public.workspace_members
  for select using (user_id = auth.uid());

-- For INSERT/UPDATE/DELETE, we need to check ownership
-- Use a SECURITY DEFINER helper function (minimal, safe usage)
create or replace function public.is_workspace_owner_or_admin(ws_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = ws_id
      and user_id = auth.uid()
      and role in ('owner', 'admin')
  );
$$ language sql security definer stable;

create policy "workspace_members_insert" on public.workspace_members
  for insert with check (public.is_workspace_owner_or_admin(workspace_id));

create policy "workspace_members_update" on public.workspace_members
  for update using (public.is_workspace_owner_or_admin(workspace_id));

create policy "workspace_members_delete" on public.workspace_members
  for delete using (
    user_id = auth.uid()  -- can leave yourself
    or public.is_workspace_owner_or_admin(workspace_id)
  );

-- Function for owners to get all members of their workspace
create or replace function public.get_workspace_members(ws_id uuid)
returns table (
  id uuid,
  user_id uuid,
  role text,
  created_at timestamptz,
  user_email text,
  user_name text
) as $$
begin
  -- Verify caller is owner or admin
  if not public.is_workspace_owner_or_admin(ws_id) then
    raise exception 'Not authorized';
  end if;

  return query
  select
    wm.id,
    wm.user_id,
    wm.role,
    wm.created_at,
    u.email as user_email,
    u.name as user_name
  from public.workspace_members wm
  join public.users u on u.id = wm.user_id
  where wm.workspace_id = ws_id;
end;
$$ language plpgsql security definer;
