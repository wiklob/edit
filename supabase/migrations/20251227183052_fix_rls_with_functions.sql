-- Drop all existing policies on these tables
drop policy if exists "Can read workspace" on public.workspaces;
drop policy if exists "Authenticated users can create workspaces" on public.workspaces;
drop policy if exists "Owner can update workspace" on public.workspaces;
drop policy if exists "Owner can delete workspace" on public.workspaces;

drop policy if exists "Can read workspace members" on public.workspace_members;
drop policy if exists "Owner can manage workspace members" on public.workspace_members;
drop policy if exists "Owner can remove workspace members" on public.workspace_members;

drop policy if exists "Can read sections" on public.sections;
drop policy if exists "Can create sections" on public.sections;
drop policy if exists "Owner can update sections" on public.sections;
drop policy if exists "Owner can delete sections" on public.sections;

drop policy if exists "Can read section access" on public.section_access;
drop policy if exists "Owner can grant section access" on public.section_access;
drop policy if exists "Owner can revoke section access" on public.section_access;

-- Create helper functions that bypass RLS (security definer)
create or replace function public.is_workspace_owner(ws_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.workspaces
    where id = ws_id and owner_id = auth.uid()
  );
$$ language sql security definer stable;

create or replace function public.is_workspace_member(ws_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = ws_id and user_id = auth.uid()
  );
$$ language sql security definer stable;

create or replace function public.get_user_workspace_ids()
returns setof uuid as $$
  select id from public.workspaces where owner_id = auth.uid()
  union
  select workspace_id from public.workspace_members where user_id = auth.uid();
$$ language sql security definer stable;

-- Workspaces policies (using functions)
create policy "workspaces_select"
  on public.workspaces for select
  using (owner_id = auth.uid() or public.is_workspace_member(id));

create policy "workspaces_insert"
  on public.workspaces for insert
  with check (owner_id = auth.uid());

create policy "workspaces_update"
  on public.workspaces for update
  using (owner_id = auth.uid());

create policy "workspaces_delete"
  on public.workspaces for delete
  using (owner_id = auth.uid());

-- Workspace members policies
create policy "workspace_members_select"
  on public.workspace_members for select
  using (user_id = auth.uid() or public.is_workspace_owner(workspace_id));

create policy "workspace_members_insert"
  on public.workspace_members for insert
  with check (public.is_workspace_owner(workspace_id));

create policy "workspace_members_delete"
  on public.workspace_members for delete
  using (public.is_workspace_owner(workspace_id));

-- Sections policies
create policy "sections_select"
  on public.sections for select
  using (
    public.is_workspace_owner(workspace_id)
    or exists (
      select 1 from public.section_access sa
      join public.workspace_members wm on wm.id = sa.member_id
      where sa.section_id = sections.id and wm.user_id = auth.uid()
    )
  );

create policy "sections_insert"
  on public.sections for insert
  with check (
    public.is_workspace_owner(workspace_id)
    or public.is_workspace_member(workspace_id)
  );

create policy "sections_update"
  on public.sections for update
  using (public.is_workspace_owner(workspace_id));

create policy "sections_delete"
  on public.sections for delete
  using (public.is_workspace_owner(workspace_id));

-- Section access policies
create policy "section_access_select"
  on public.section_access for select
  using (
    exists (
      select 1 from public.workspace_members wm
      where wm.id = section_access.member_id and wm.user_id = auth.uid()
    )
    or exists (
      select 1 from public.sections s
      where s.id = section_access.section_id
      and public.is_workspace_owner(s.workspace_id)
    )
  );

create policy "section_access_insert"
  on public.section_access for insert
  with check (
    exists (
      select 1 from public.sections s
      where s.id = section_id
      and public.is_workspace_owner(s.workspace_id)
    )
  );

create policy "section_access_delete"
  on public.section_access for delete
  using (
    exists (
      select 1 from public.sections s
      where s.id = section_id
      and public.is_workspace_owner(s.workspace_id)
    )
  );
