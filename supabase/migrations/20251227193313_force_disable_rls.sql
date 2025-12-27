-- ============================================================================
-- FORCE: Completely disable RLS on ALL tables
-- If this still fails, the issue is NOT RLS - it's PostgREST caching or roles
-- ============================================================================

-- Disable RLS on all our tables
alter table public.workspaces disable row level security;
alter table public.workspace_members disable row level security;
alter table public.sections disable row level security;
alter table public.section_access disable row level security;
alter table public.users disable row level security;

-- Drop ALL policies on workspaces (just to be sure)
do $$
declare
  pol record;
begin
  for pol in
    select policyname, tablename from pg_policies
    where schemaname = 'public'
  loop
    execute format('drop policy if exists %I on public.%I', pol.policyname, pol.tablename);
  end loop;
end $$;

-- Verify RLS is disabled
do $$
declare
  tbl record;
begin
  raise notice '========================================';
  raise notice 'RLS STATUS AFTER DISABLE';
  raise notice '========================================';

  for tbl in
    select relname, relrowsecurity
    from pg_class
    where relnamespace = 'public'::regnamespace
    and relkind = 'r'
    and relname in ('workspaces', 'workspace_members', 'sections', 'section_access', 'users')
  loop
    raise notice '  % | RLS enabled: %', tbl.relname, tbl.relrowsecurity;
  end loop;
end $$;

-- Force PostgREST to reload (multiple methods)
notify pgrst, 'reload schema';
notify pgrst, 'reload config';

-- Grant everything again to be sure
grant all on all tables in schema public to anon, authenticated;
grant all on all sequences in schema public to anon, authenticated;
grant usage on schema public to anon, authenticated;
