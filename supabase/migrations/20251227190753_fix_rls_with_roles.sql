-- ============================================================================
-- FIX RLS: Explicitly target 'authenticated' role
-- ============================================================================

-- Re-enable RLS
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.sections enable row level security;
alter table public.section_access enable row level security;
alter table public.users enable row level security;

-- ============================================================================
-- Drop all existing policies
-- ============================================================================

-- users
drop policy if exists "users_select" on public.users;
drop policy if exists "users_update" on public.users;

-- workspaces
drop policy if exists "workspaces_select" on public.workspaces;
drop policy if exists "workspaces_insert" on public.workspaces;
drop policy if exists "workspaces_update" on public.workspaces;
drop policy if exists "workspaces_delete" on public.workspaces;

-- workspace_members
drop policy if exists "workspace_members_select" on public.workspace_members;
drop policy if exists "workspace_members_insert" on public.workspace_members;
drop policy if exists "workspace_members_update" on public.workspace_members;
drop policy if exists "workspace_members_delete" on public.workspace_members;

-- sections
drop policy if exists "sections_select" on public.sections;
drop policy if exists "sections_insert" on public.sections;
drop policy if exists "sections_update" on public.sections;
drop policy if exists "sections_delete" on public.sections;

-- section_access
drop policy if exists "section_access_select" on public.section_access;
drop policy if exists "section_access_insert" on public.section_access;
drop policy if exists "section_access_delete" on public.section_access;

-- ============================================================================
-- Recreate policies with explicit 'authenticated' role
-- ============================================================================

-- users
create policy "users_select" on public.users
  for select to authenticated
  using (true);

create policy "users_update" on public.users
  for update to authenticated
  using (id = auth.uid());

-- workspaces
create policy "workspaces_select" on public.workspaces
  for select to authenticated
  using (
    id in (select workspace_id from public.workspace_members where user_id = auth.uid())
  );

create policy "workspaces_insert" on public.workspaces
  for insert to authenticated
  with check (true);

create policy "workspaces_update" on public.workspaces
  for update to authenticated
  using (public.is_workspace_owner_or_admin(id));

create policy "workspaces_delete" on public.workspaces
  for delete to authenticated
  using (
    id in (
      select workspace_id from public.workspace_members
      where user_id = auth.uid() and role = 'owner'
    )
  );

-- workspace_members
create policy "workspace_members_select" on public.workspace_members
  for select to authenticated
  using (user_id = auth.uid());

create policy "workspace_members_insert" on public.workspace_members
  for insert to authenticated
  with check (public.is_workspace_owner_or_admin(workspace_id));

create policy "workspace_members_update" on public.workspace_members
  for update to authenticated
  using (public.is_workspace_owner_or_admin(workspace_id));

create policy "workspace_members_delete" on public.workspace_members
  for delete to authenticated
  using (
    user_id = auth.uid()
    or public.is_workspace_owner_or_admin(workspace_id)
  );

-- sections
create policy "sections_select" on public.sections
  for select to authenticated
  using (
    workspace_id in (
      select workspace_id from public.workspace_members
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
    or id in (
      select section_id from public.section_access
      where member_id in (
        select id from public.workspace_members where user_id = auth.uid()
      )
    )
  );

create policy "sections_insert" on public.sections
  for insert to authenticated
  with check (
    workspace_id in (
      select workspace_id from public.workspace_members where user_id = auth.uid()
    )
  );

create policy "sections_update" on public.sections
  for update to authenticated
  using (
    workspace_id in (
      select workspace_id from public.workspace_members
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
  );

create policy "sections_delete" on public.sections
  for delete to authenticated
  using (
    workspace_id in (
      select workspace_id from public.workspace_members
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
  );

-- section_access
create policy "section_access_select" on public.section_access
  for select to authenticated
  using (
    member_id in (select id from public.workspace_members where user_id = auth.uid())
    or workspace_id in (
      select workspace_id from public.workspace_members
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
  );

create policy "section_access_insert" on public.section_access
  for insert to authenticated
  with check (
    section_id in (
      select s.id from public.sections s
      where s.workspace_id in (
        select workspace_id from public.workspace_members
        where user_id = auth.uid() and role in ('owner', 'admin')
      )
    )
  );

create policy "section_access_delete" on public.section_access
  for delete to authenticated
  using (
    workspace_id in (
      select workspace_id from public.workspace_members
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
  );
