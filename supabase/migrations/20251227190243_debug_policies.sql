-- Check if RLS is enabled on workspaces
do $$
declare
  rls_enabled boolean;
begin
  select relrowsecurity into rls_enabled
  from pg_class
  where relname = 'workspaces' and relnamespace = 'public'::regnamespace;

  raise notice 'RLS enabled on workspaces: %', rls_enabled;
end $$;

-- List all policies on workspaces
do $$
declare
  pol record;
begin
  raise notice 'Current policies on workspaces:';
  for pol in
    select policyname, cmd from pg_policies
    where tablename = 'workspaces' and schemaname = 'public'
  loop
    raise notice '  - % (%)', pol.policyname, pol.cmd;
  end loop;
end $$;

-- Force drop and recreate
drop policy if exists "workspaces_select" on public.workspaces;
drop policy if exists "workspaces_insert" on public.workspaces;
drop policy if exists "workspaces_update" on public.workspaces;
drop policy if exists "workspaces_delete" on public.workspaces;

-- Ensure RLS is enabled
alter table public.workspaces enable row level security;

-- Recreate policies
create policy "workspaces_select" on public.workspaces
  for select using (
    id in (select workspace_id from public.workspace_members where user_id = auth.uid())
  );

create policy "workspaces_insert" on public.workspaces
  for insert with check (true);

create policy "workspaces_update" on public.workspaces
  for update using (public.is_workspace_owner_or_admin(id));

create policy "workspaces_delete" on public.workspaces
  for delete using (
    id in (
      select workspace_id from public.workspace_members
      where user_id = auth.uid() and role = 'owner'
    )
  );

-- Verify policies were created
do $$
declare
  pol_count integer;
begin
  select count(*) into pol_count
  from pg_policies
  where tablename = 'workspaces' and schemaname = 'public';

  raise notice 'Total policies on workspaces after recreation: %', pol_count;
end $$;
