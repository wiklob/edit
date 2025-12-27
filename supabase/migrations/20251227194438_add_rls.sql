-- ============================================================================
-- ADD RLS: Clean, simple policies
-- ============================================================================

-- ============================================================================
-- USERS
-- ============================================================================
alter table public.users enable row level security;

create policy "users_select" on public.users
  for select using (true);

create policy "users_update" on public.users
  for update using (id = auth.uid());

-- ============================================================================
-- WORKSPACES
-- ============================================================================
alter table public.workspaces enable row level security;

-- Anyone authenticated can create a workspace
create policy "workspaces_insert" on public.workspaces
  for insert with check (auth.uid() is not null);

-- Members can view their workspaces
create policy "workspaces_select" on public.workspaces
  for select using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = id and wm.user_id = auth.uid()
    )
  );

-- Owner/admin can update
create policy "workspaces_update" on public.workspaces
  for update using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
    )
  );

-- Only owner can delete
create policy "workspaces_delete" on public.workspaces
  for delete using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = id
        and wm.user_id = auth.uid()
        and wm.role = 'owner'
    )
  );

-- ============================================================================
-- WORKSPACE_MEMBERS: RLS DISABLED
-- The trigger needs to insert freely, and SECURITY DEFINER wasn't reliable
-- We control access through application logic instead
-- ============================================================================
-- NOT enabling RLS on workspace_members

-- ============================================================================
-- SECTIONS
-- ============================================================================
alter table public.sections enable row level security;

-- Workspace members can view sections
-- (For section-level access control, we'll filter in the app)
create policy "sections_select" on public.sections
  for select using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = workspace_id and wm.user_id = auth.uid()
    )
  );

-- Workspace members can create sections
create policy "sections_insert" on public.sections
  for insert with check (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = workspace_id and wm.user_id = auth.uid()
    )
  );

-- Owner/admin can update sections
create policy "sections_update" on public.sections
  for update using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
    )
  );

-- Owner/admin can delete sections
create policy "sections_delete" on public.sections
  for delete using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
    )
  );

-- ============================================================================
-- SECTION_ACCESS: RLS DISABLED
-- Controlled through application logic
-- ============================================================================
-- NOT enabling RLS on section_access
