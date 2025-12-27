-- Drop and recreate with simplest possible policy
drop policy if exists "workspaces_insert" on public.workspaces;

create policy "workspaces_insert" on public.workspaces
  for insert with check (true);
