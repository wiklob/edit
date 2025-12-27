-- ============================================================================
-- NUKE AND REBUILD: Drop everything and start fresh
-- Keep auth.* tables untouched
-- ============================================================================

-- Drop all triggers first
drop trigger if exists on_workspace_created on public.workspaces;
drop trigger if exists on_auth_user_created on auth.users;

-- Drop all functions
drop function if exists public.handle_new_workspace();
drop function if exists public.handle_new_user();
drop function if exists public.is_workspace_owner_or_admin(uuid);
drop function if exists public.get_workspace_members(uuid);
drop function if exists public.set_section_access_workspace_id();

-- Drop all tables (order matters for foreign keys)
drop table if exists public.section_access cascade;
drop table if exists public.sections cascade;
drop table if exists public.workspace_members cascade;
drop table if exists public.workspaces cascade;
drop table if exists public.users cascade;

-- ============================================================================
-- REBUILD: Fresh tables with minimal setup
-- ============================================================================

-- Users table (synced from auth.users)
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  name text,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Workspaces
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Workspace members (who belongs to which workspace)
create table public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz default now(),
  unique(workspace_id, user_id)
);

-- Sections within workspaces
create table public.sections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Section access (which members can access which sections)
create table public.section_access (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.sections(id) on delete cascade,
  member_id uuid not null references public.workspace_members(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_at timestamptz default now(),
  unique(section_id, member_id)
);

-- ============================================================================
-- TRIGGERS: Sync users and auto-add workspace owner
-- ============================================================================

-- Sync new auth users to public.users
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name'),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Auto-add creator as workspace owner
create or replace function public.handle_new_workspace()
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

create trigger on_workspace_created
  after insert on public.workspaces
  for each row execute function public.handle_new_workspace();

-- ============================================================================
-- GRANTS: Full access for anon and authenticated
-- ============================================================================
grant usage on schema public to anon, authenticated;
grant all on public.users to anon, authenticated;
grant all on public.workspaces to anon, authenticated;
grant all on public.workspace_members to anon, authenticated;
grant all on public.sections to anon, authenticated;
grant all on public.section_access to anon, authenticated;

-- ============================================================================
-- RLS: Disabled for now - we'll add it incrementally AFTER testing basic ops
-- ============================================================================
-- NO RLS ENABLED YET - test that basic CRUD works first

-- Backfill existing auth users
insert into public.users (id, email, name, avatar_url)
select
  id,
  email,
  coalesce(raw_user_meta_data->>'name', raw_user_meta_data->>'full_name'),
  raw_user_meta_data->>'avatar_url'
from auth.users
on conflict (id) do nothing;

-- Verify
do $$
begin
  raise notice '========================================';
  raise notice 'REBUILD COMPLETE';
  raise notice '========================================';
  raise notice 'Tables created: users, workspaces, workspace_members, sections, section_access';
  raise notice 'RLS: DISABLED on all tables';
  raise notice 'Grants: Full access to anon and authenticated';
  raise notice '========================================';
end $$;
