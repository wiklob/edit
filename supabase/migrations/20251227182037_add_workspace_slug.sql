-- Add slug column to workspaces
alter table public.workspaces add column slug text unique;

-- Make slug required for new rows
alter table public.workspaces alter column slug set not null;

-- Index for fast slug lookups
create index idx_workspaces_slug on public.workspaces(slug);
