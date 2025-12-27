-- ============================================================================
-- GRANT table-level permissions to authenticated role
-- RLS policies control access, but GRANT gives base permission to attempt operations
-- ============================================================================

-- Re-enable RLS (in case it was disabled for testing)
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.sections enable row level security;
alter table public.section_access enable row level security;
alter table public.users enable row level security;

-- Grant table-level permissions
grant select, insert, update, delete on public.workspaces to authenticated;
grant select, insert, update, delete on public.workspace_members to authenticated;
grant select, insert, update, delete on public.sections to authenticated;
grant select, insert, update, delete on public.section_access to authenticated;
grant select, update on public.users to authenticated;

-- Grant usage on sequences (for auto-generated IDs if any)
grant usage on all sequences in schema public to authenticated;
