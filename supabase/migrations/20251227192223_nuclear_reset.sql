-- ============================================================================
-- NUCLEAR RESET: Complete debug and fix
-- ============================================================================

-- Step 1: Check current state
do $$
declare
  r record;
begin
  raise notice '========================================';
  raise notice 'STEP 1: CURRENT GRANTS ON WORKSPACES';
  raise notice '========================================';

  for r in
    select grantee, privilege_type
    from information_schema.table_privileges
    where table_schema = 'public' and table_name = 'workspaces'
  loop
    raise notice 'Grantee: % | Privilege: %', r.grantee, r.privilege_type;
  end loop;
end $$;

do $$
declare
  r record;
begin
  raise notice '========================================';
  raise notice 'STEP 2: SCHEMA USAGE GRANTS';
  raise notice '========================================';

  for r in
    select grantee, privilege_type
    from information_schema.usage_privileges
    where object_schema = 'public'
  loop
    raise notice 'Grantee: % | Privilege: %', r.grantee, r.privilege_type;
  end loop;
end $$;

-- Step 3: Drop ALL policies on workspaces
do $$
declare
  pol record;
begin
  raise notice '========================================';
  raise notice 'STEP 3: DROPPING ALL WORKSPACES POLICIES';
  raise notice '========================================';

  for pol in
    select policyname from pg_policies
    where tablename = 'workspaces' and schemaname = 'public'
  loop
    raise notice 'Dropping: %', pol.policyname;
    execute format('drop policy if exists %I on public.workspaces', pol.policyname);
  end loop;
end $$;

-- Step 4: Disable then re-enable RLS
alter table public.workspaces disable row level security;
alter table public.workspaces enable row level security;

-- Step 5: Grant EVERYTHING to both anon and authenticated
grant usage on schema public to anon, authenticated;
grant all privileges on public.workspaces to anon, authenticated;
grant all privileges on public.workspace_members to anon, authenticated;
grant all privileges on public.sections to anon, authenticated;
grant all privileges on public.section_access to anon, authenticated;
grant all privileges on public.users to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;

-- Step 6: Create the simplest possible INSERT policy
create policy "allow_all_insert" on public.workspaces
  for insert
  to anon, authenticated
  with check (true);

-- Step 7: Create other policies
create policy "allow_member_select" on public.workspaces
  for select
  to anon, authenticated
  using (
    id in (select workspace_id from public.workspace_members where user_id = auth.uid())
  );

create policy "allow_owner_update" on public.workspaces
  for update
  to anon, authenticated
  using (public.is_workspace_owner_or_admin(id));

create policy "allow_owner_delete" on public.workspaces
  for delete
  to anon, authenticated
  using (
    id in (
      select workspace_id from public.workspace_members
      where user_id = auth.uid() and role = 'owner'
    )
  );

-- Step 8: Verify
do $$
declare
  pol record;
  grant_rec record;
begin
  raise notice '========================================';
  raise notice 'STEP 8: VERIFICATION';
  raise notice '========================================';

  raise notice 'Policies on workspaces:';
  for pol in
    select policyname, cmd, roles, qual, with_check
    from pg_policies
    where tablename = 'workspaces' and schemaname = 'public'
  loop
    raise notice '  % | % | roles=% | with_check=%',
      pol.policyname, pol.cmd, pol.roles, pol.with_check;
  end loop;

  raise notice 'Grants on workspaces:';
  for grant_rec in
    select grantee, string_agg(privilege_type, ', ') as privs
    from information_schema.table_privileges
    where table_schema = 'public' and table_name = 'workspaces'
    group by grantee
  loop
    raise notice '  % has: %', grant_rec.grantee, grant_rec.privs;
  end loop;
end $$;

-- Step 9: Notify PostgREST to reload schema (Supabase specific)
notify pgrst, 'reload schema';
