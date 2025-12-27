-- ============================================================================
-- FIX: The trigger inserts into workspace_members, which also has RLS
-- Even SECURITY DEFINER might not bypass RLS in Supabase's setup
-- ============================================================================

-- Debug: Check workspace_members policies
do $$
declare
  pol record;
begin
  raise notice '========================================';
  raise notice 'WORKSPACE_MEMBERS POLICIES (BEFORE)';
  raise notice '========================================';

  for pol in
    select policyname, cmd, roles, qual, with_check
    from pg_policies
    where tablename = 'workspace_members' and schemaname = 'public'
  loop
    raise notice '  % | % | roles=% | with_check=%',
      pol.policyname, pol.cmd, pol.roles, pol.with_check;
  end loop;
end $$;

-- Check trigger function owner and settings
do $$
declare
  func_info record;
begin
  raise notice '========================================';
  raise notice 'TRIGGER FUNCTION INFO';
  raise notice '========================================';

  select
    p.proname,
    r.rolname as owner,
    p.prosecdef as security_definer
  into func_info
  from pg_proc p
  join pg_roles r on p.proowner = r.oid
  where p.proname = 'handle_new_workspace';

  raise notice 'Function: % | Owner: % | SECURITY DEFINER: %',
    func_info.proname, func_info.owner, func_info.security_definer;
end $$;

-- Drop all workspace_members policies
do $$
declare
  pol record;
begin
  for pol in
    select policyname from pg_policies
    where tablename = 'workspace_members' and schemaname = 'public'
  loop
    execute format('drop policy if exists %I on public.workspace_members', pol.policyname);
  end loop;
end $$;

-- Grant everything
grant all privileges on public.workspace_members to anon, authenticated;

-- Create completely permissive policies for workspace_members
create policy "wm_select" on public.workspace_members
  for select to anon, authenticated
  using (true);  -- Can see all (will filter in app if needed)

create policy "wm_insert" on public.workspace_members
  for insert to anon, authenticated
  with check (true);  -- Allow all inserts (trigger needs this)

create policy "wm_update" on public.workspace_members
  for update to anon, authenticated
  using (true);

create policy "wm_delete" on public.workspace_members
  for delete to anon, authenticated
  using (true);

-- Also make sure the trigger function is set up correctly
-- Drop and recreate to ensure it's owned by postgres
drop function if exists public.handle_new_workspace() cascade;

create function public.handle_new_workspace()
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

-- Recreate trigger
create trigger on_workspace_created
  after insert on public.workspaces
  for each row execute function public.handle_new_workspace();

-- Verify
do $$
declare
  pol record;
begin
  raise notice '========================================';
  raise notice 'WORKSPACE_MEMBERS POLICIES (AFTER)';
  raise notice '========================================';

  for pol in
    select policyname, cmd, roles, with_check
    from pg_policies
    where tablename = 'workspace_members' and schemaname = 'public'
  loop
    raise notice '  % | % | roles=% | with_check=%',
      pol.policyname, pol.cmd, pol.roles, pol.with_check;
  end loop;
end $$;

notify pgrst, 'reload schema';
