-- ============================================================================
-- Force PostgREST schema reload by making actual schema changes
-- ============================================================================

-- Add a dummy column and remove it - this forces schema cache invalidation
alter table public.workspaces add column if not exists _force_reload boolean;
alter table public.workspaces drop column if exists _force_reload;

-- Also try commenting on the table (another way to invalidate cache)
comment on table public.workspaces is 'Workspaces table - schema reload triggered';

-- Verify current policy state
do $$
declare
  pol record;
begin
  raise notice '========================================';
  raise notice 'WORKSPACES POLICIES (should be simple)';
  raise notice '========================================';

  for pol in
    select policyname, cmd, permissive, roles, qual, with_check
    from pg_policies
    where schemaname = 'public' and tablename = 'workspaces'
  loop
    raise notice '% | % | permissive=% | roles=% | with_check=%',
      pol.policyname, pol.cmd, pol.permissive, pol.roles, pol.with_check;
  end loop;
end $$;

-- Multiple notify attempts
notify pgrst, 'reload schema';
notify pgrst, 'reload config';

-- Small delay then notify again
select pg_sleep(0.1);
notify pgrst, 'reload schema';
