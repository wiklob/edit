-- Temporarily disable RLS on workspaces to test if that's the issue
alter table public.workspaces disable row level security;

-- Also on workspace_members in case the trigger is the issue
alter table public.workspace_members disable row level security;
