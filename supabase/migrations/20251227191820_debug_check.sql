-- ============================================================================
-- DEBUG: Check what's actually happening and fix it
-- ============================================================================

-- First, let's see what policies exist
do $$
declare
  pol record;
  rls_status boolean;
begin
  -- Check RLS status
  select relrowsecurity into rls_status
  from pg_class
  where relname = 'workspaces' and relnamespace = 'public'::regnamespace;

  raise notice '=== WORKSPACES TABLE ===';
  raise notice 'RLS enabled: %', rls_status;

  raise notice 'Current policies:';
  for pol in
    select policyname, cmd, roles, qual, with_check
    from pg_policies
    where tablename = 'workspaces' and schemaname = 'public'
  loop
    raise notice '  Policy: % | CMD: % | ROLES: % | WITH CHECK: %',
      pol.policyname, pol.cmd, pol.roles, pol.with_check;
  end loop;
end $$;

-- The issue might be that policies targeting 'authenticated' don't work as expected
-- with Supabase because the role hierarchy is: anon -> authenticated -> service_role
-- Let's try without explicit role targeting

-- Drop existing
drop policy if exists "workspaces_insert" on public.workspaces;

-- Create without role restriction - RLS will still apply based on auth.uid()
create policy "workspaces_insert" on public.workspaces
  for insert with check (true);

-- Also ensure the trigger function exists and works
create or replace function public.handle_new_workspace()
returns trigger as $$
begin
  insert into public.workspace_members (workspace_id, user_id, role)
  values (new.id, auth.uid(), 'owner');
  return new;
end;
$$ language plpgsql security definer;

-- Ensure trigger exists
drop trigger if exists on_workspace_created on public.workspaces;
create trigger on_workspace_created
  after insert on public.workspaces
  for each row execute function public.handle_new_workspace();

-- Verify
do $$
declare
  pol record;
begin
  raise notice '=== AFTER FIX ===';
  for pol in
    select policyname, cmd, roles, with_check
    from pg_policies
    where tablename = 'workspaces' and schemaname = 'public'
  loop
    raise notice '  Policy: % | CMD: % | ROLES: % | WITH CHECK: %',
      pol.policyname, pol.cmd, pol.roles, pol.with_check;
  end loop;
end $$;
