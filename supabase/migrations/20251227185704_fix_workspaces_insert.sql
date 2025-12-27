-- Drop ALL policies on workspaces (catch any leftover ones)
do $$
declare
  pol record;
begin
  for pol in
    select policyname from pg_policies where tablename = 'workspaces' and schemaname = 'public'
  loop
    execute format('drop policy if exists %I on public.workspaces', pol.policyname);
  end loop;
end $$;

-- Recreate workspaces policies
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
    exists (
      select 1 from public.workspace_members
      where workspace_id = id and user_id = auth.uid() and role = 'owner'
    )
  );
