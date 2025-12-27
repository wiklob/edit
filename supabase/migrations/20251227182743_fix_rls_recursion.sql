-- Drop the recursive policies
drop policy if exists "Members can read workspace" on public.workspaces;
drop policy if exists "Members can read workspace members" on public.workspace_members;
drop policy if exists "Can read sections with access" on public.sections;
drop policy if exists "Workspace members can create sections" on public.sections;
drop policy if exists "Can read own section access" on public.section_access;

-- Workspaces: can read if owner OR if you're a member
-- Use a simpler check that doesn't cause recursion
create policy "Can read workspace"
  on public.workspaces for select
  using (
    owner_id = auth.uid()
    or id in (
      select workspace_id from public.workspace_members where user_id = auth.uid()
    )
  );

-- Workspace members: can read your own memberships OR if you're the workspace owner
-- Avoid querying workspace_members from within itself
create policy "Can read workspace members"
  on public.workspace_members for select
  using (
    user_id = auth.uid()
    or workspace_id in (
      select id from public.workspaces where owner_id = auth.uid()
    )
  );

-- Sections: simpler policy
create policy "Can read sections"
  on public.sections for select
  using (
    workspace_id in (
      select id from public.workspaces where owner_id = auth.uid()
    )
    or id in (
      select sa.section_id from public.section_access sa
      where sa.member_id in (
        select wm.id from public.workspace_members wm where wm.user_id = auth.uid()
      )
    )
  );

create policy "Can create sections"
  on public.sections for insert
  with check (
    workspace_id in (
      select id from public.workspaces where owner_id = auth.uid()
    )
    or workspace_id in (
      select workspace_id from public.workspace_members where user_id = auth.uid()
    )
  );

-- Section access: simpler policy
create policy "Can read section access"
  on public.section_access for select
  using (
    member_id in (
      select id from public.workspace_members where user_id = auth.uid()
    )
    or section_id in (
      select s.id from public.sections s
      join public.workspaces w on w.id = s.workspace_id
      where w.owner_id = auth.uid()
    )
  );
