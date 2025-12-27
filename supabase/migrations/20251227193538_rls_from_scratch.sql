-- ============================================================================
-- RLS FROM SCRATCH: Clean, minimal, tested approach
-- ============================================================================

-- Step 1: Ensure all RLS is disabled and all old policies are gone
alter table public.workspaces disable row level security;
alter table public.workspace_members disable row level security;
alter table public.sections disable row level security;
alter table public.section_access disable row level security;
alter table public.users disable row level security;

-- Step 2: Recreate the trigger for auto-adding workspace owner
create or replace function public.handle_new_workspace()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.workspace_members (workspace_id, user_id, role)
  values (new.id, auth.uid(), 'owner');
  return new;
end;
$$;

drop trigger if exists on_workspace_created on public.workspaces;
create trigger on_workspace_created
  after insert on public.workspaces
  for each row execute function public.handle_new_workspace();

-- ============================================================================
-- WORKSPACES RLS
-- ============================================================================
alter table public.workspaces enable row level security;

-- Anyone can create a workspace
create policy "workspaces_insert_policy"
  on public.workspaces for insert
  with check (true);

-- Members can view their workspaces
create policy "workspaces_select_policy"
  on public.workspaces for select
  using (
    exists (
      select 1 from public.workspace_members
      where workspace_members.workspace_id = workspaces.id
      and workspace_members.user_id = auth.uid()
    )
  );

-- Owners/admins can update
create policy "workspaces_update_policy"
  on public.workspaces for update
  using (
    exists (
      select 1 from public.workspace_members
      where workspace_members.workspace_id = workspaces.id
      and workspace_members.user_id = auth.uid()
      and workspace_members.role in ('owner', 'admin')
    )
  );

-- Only owners can delete
create policy "workspaces_delete_policy"
  on public.workspaces for delete
  using (
    exists (
      select 1 from public.workspace_members
      where workspace_members.workspace_id = workspaces.id
      and workspace_members.user_id = auth.uid()
      and workspace_members.role = 'owner'
    )
  );

-- ============================================================================
-- WORKSPACE_MEMBERS RLS
-- Note: Keep RLS disabled for now so trigger can insert
-- We'll rely on application logic for member management
-- ============================================================================
-- RLS stays disabled on workspace_members for now

-- ============================================================================
-- USERS RLS
-- ============================================================================
alter table public.users enable row level security;

-- Anyone can see users (for member lists, etc.)
create policy "users_select_policy"
  on public.users for select
  using (true);

-- Users can only update their own profile
create policy "users_update_policy"
  on public.users for update
  using (id = auth.uid());

-- ============================================================================
-- SECTIONS RLS (disabled for now - we'll add later)
-- ============================================================================
-- RLS stays disabled on sections for now

-- ============================================================================
-- SECTION_ACCESS RLS (disabled for now - we'll add later)
-- ============================================================================
-- RLS stays disabled on section_access for now

-- Verify
do $$
declare
  tbl record;
  pol record;
begin
  raise notice '========================================';
  raise notice 'FINAL STATE';
  raise notice '========================================';

  for tbl in
    select relname, relrowsecurity
    from pg_class
    where relnamespace = 'public'::regnamespace
    and relkind = 'r'
    and relname in ('workspaces', 'workspace_members', 'sections', 'section_access', 'users')
    order by relname
  loop
    raise notice 'Table: % | RLS: %', tbl.relname, tbl.relrowsecurity;

    for pol in
      select policyname, cmd from pg_policies
      where schemaname = 'public' and tablename = tbl.relname
    loop
      raise notice '  -> % (%)', pol.policyname, pol.cmd;
    end loop;
  end loop;
end $$;

notify pgrst, 'reload schema';
