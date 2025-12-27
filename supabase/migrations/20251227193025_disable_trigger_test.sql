-- ============================================================================
-- TEST: Disable trigger, keep RLS, see if INSERT works
-- This isolates whether the issue is the trigger or the workspaces RLS
-- ============================================================================

-- Drop the trigger
drop trigger if exists on_workspace_created on public.workspaces;

-- Verify current state
do $$
declare
  pol record;
  trig record;
begin
  raise notice '========================================';
  raise notice 'WORKSPACES POLICIES';
  raise notice '========================================';

  for pol in
    select policyname, cmd, roles, with_check
    from pg_policies
    where tablename = 'workspaces' and schemaname = 'public'
  loop
    raise notice '  % | % | roles=% | with_check=%',
      pol.policyname, pol.cmd, pol.roles, pol.with_check;
  end loop;

  raise notice '========================================';
  raise notice 'TRIGGERS ON WORKSPACES';
  raise notice '========================================';

  for trig in
    select tgname from pg_trigger
    where tgrelid = 'public.workspaces'::regclass
    and not tgisinternal
  loop
    raise notice '  %', trig.tgname;
  end loop;

  if not found then
    raise notice '  (no triggers)';
  end if;
end $$;

-- Ensure RLS is enabled
alter table public.workspaces enable row level security;

notify pgrst, 'reload schema';
