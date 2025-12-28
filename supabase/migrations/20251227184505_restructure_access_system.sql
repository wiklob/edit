-- ============================================================================
-- RESTRUCTURE ACCESS SYSTEM
-- ============================================================================
-- Key changes:
-- 1. Remove workspaces.owner_id - ownership is now in workspace_members.role
-- 2. Add role column to workspace_members ('owner', 'admin', 'member')
-- 3. Add workspace_id to section_access (denormalized to avoid circular RLS)
-- 4. Rewrite all RLS policies with no circular dependencies
-- ============================================================================

-- ============================================================================
-- STEP 1: Drop ALL existing policies
-- ============================================================================

-- users
drop policy if exists "Users can read all users" on public.users;
drop policy if exists "Users can update own profile" on public.users;
drop policy if exists "users_select" on public.users;
drop policy if exists "users_update" on public.users;

-- workspaces
drop policy if exists "workspaces_select" on public.workspaces;
drop policy if exists "workspaces_insert" on public.workspaces;
drop policy if exists "workspaces_update" on public.workspaces;
drop policy if exists "workspaces_delete" on public.workspaces;

-- workspace_members
drop policy if exists "workspace_members_select" on public.workspace_members;
drop policy if exists "workspace_members_insert" on public.workspace_members;
drop policy if exists "workspace_members_delete" on public.workspace_members;

-- sections
drop policy if exists "sections_select" on public.sections;
drop policy if exists "sections_insert" on public.sections;
drop policy if exists "sections_update" on public.sections;
drop policy if exists "sections_delete" on public.sections;

-- section_access
drop policy if exists "section_access_select" on public.section_access;
drop policy if exists "section_access_insert" on public.section_access;
drop policy if exists "section_access_delete" on public.section_access;

-- Drop old helper functions if they exist
drop function if exists public.is_workspace_owner(uuid);
drop function if exists public.is_workspace_member(uuid);
drop function if exists public.get_user_workspace_ids();

-- ============================================================================
-- STEP 2: Alter tables
-- ============================================================================

-- Add role to workspace_members
alter table public.workspace_members
  add column if not exists role text not null default 'member';

-- Add check constraint for role values
alter table public.workspace_members
  drop constraint if exists workspace_members_role_check;
alter table public.workspace_members
  add constraint workspace_members_role_check
  check (role in ('owner', 'admin', 'member'));

-- Add workspace_id to section_access (denormalized)
alter table public.section_access
  add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;

-- Remove owner_id from workspaces (ownership now in workspace_members)
-- First, migrate existing owners to workspace_members
insert into public.workspace_members (workspace_id, user_id, role)
select id, owner_id, 'owner' from public.workspaces
where owner_id is not null
on conflict (workspace_id, user_id) do update set role = 'owner';

-- Now drop owner_id
alter table public.workspaces drop column if exists owner_id;

-- ============================================================================
-- STEP 3: Create triggers for auto-population
-- ============================================================================

-- Trigger: auto-add creator as owner when workspace is created
create or replace function public.auto_add_workspace_owner()
returns trigger as $$
begin
  insert into public.workspace_members (workspace_id, user_id, role)
  values (NEW.id, auth.uid(), 'owner');
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists on_workspace_created on public.workspaces;
create trigger on_workspace_created
  after insert on public.workspaces
  for each row execute function public.auto_add_workspace_owner();

-- Trigger: auto-set workspace_id on section_access from the section
create or replace function public.set_section_access_workspace()
returns trigger as $$
begin
  select workspace_id into NEW.workspace_id
  from public.sections where id = NEW.section_id;
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists on_section_access_insert on public.section_access;
create trigger on_section_access_insert
  before insert on public.section_access
  for each row execute function public.set_section_access_workspace();

-- Trigger: prevent removing last owner from workspace
create or replace function public.prevent_last_owner_removal()
returns trigger as $$
declare
  owner_count integer;
begin
  if OLD.role = 'owner' then
    select count(*) into owner_count
    from public.workspace_members
    where workspace_id = OLD.workspace_id and role = 'owner' and id != OLD.id;

    if owner_count = 0 then
      raise exception 'Cannot remove the last owner of a workspace';
    end if;
  end if;
  return OLD;
end;
$$ language plpgsql;

drop trigger if exists on_workspace_member_delete on public.workspace_members;
create trigger on_workspace_member_delete
  before delete on public.workspace_members
  for each row execute function public.prevent_last_owner_removal();

-- Also prevent demoting last owner
create or replace function public.prevent_last_owner_demotion()
returns trigger as $$
declare
  owner_count integer;
begin
  if OLD.role = 'owner' and NEW.role != 'owner' then
    select count(*) into owner_count
    from public.workspace_members
    where workspace_id = OLD.workspace_id and role = 'owner' and id != OLD.id;

    if owner_count = 0 then
      raise exception 'Cannot demote the last owner of a workspace';
    end if;
  end if;
  return NEW;
end;
$$ language plpgsql;

drop trigger if exists on_workspace_member_update on public.workspace_members;
create trigger on_workspace_member_update
  before update on public.workspace_members
  for each row execute function public.prevent_last_owner_demotion();

-- ============================================================================
-- STEP 4: Create RLS policies (no circular dependencies)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- users: simple policies
-- ----------------------------------------------------------------------------
create policy "users_select" on public.users
  for select using (true);

create policy "users_update" on public.users
  for update using (id = auth.uid());

-- ----------------------------------------------------------------------------
-- workspace_members: self-referential but safe
-- The subquery only matches rows where user_id = auth.uid(),
-- which pass condition 1, so no infinite recursion
-- ----------------------------------------------------------------------------
create policy "workspace_members_select" on public.workspace_members
  for select using (
    user_id = auth.uid()
    or workspace_id in (
      select workspace_id from public.workspace_members
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
  );

create policy "workspace_members_insert" on public.workspace_members
  for insert with check (
    workspace_id in (
      select workspace_id from public.workspace_members
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
  );

create policy "workspace_members_update" on public.workspace_members
  for update using (
    workspace_id in (
      select workspace_id from public.workspace_members
      where user_id = auth.uid() and role = 'owner'
    )
  );

create policy "workspace_members_delete" on public.workspace_members
  for delete using (
    user_id = auth.uid()
    or workspace_id in (
      select workspace_id from public.workspace_members
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
  );

-- ----------------------------------------------------------------------------
-- workspaces: depends only on workspace_members
-- ----------------------------------------------------------------------------
create policy "workspaces_select" on public.workspaces
  for select using (
    id in (select workspace_id from public.workspace_members where user_id = auth.uid())
  );

create policy "workspaces_insert" on public.workspaces
  for insert with check (true);
  -- Anyone can create, trigger adds them as owner

create policy "workspaces_update" on public.workspaces
  for update using (
    id in (
      select workspace_id from public.workspace_members
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
  );

create policy "workspaces_delete" on public.workspaces
  for delete using (
    id in (
      select workspace_id from public.workspace_members
      where user_id = auth.uid() and role = 'owner'
    )
  );

-- ----------------------------------------------------------------------------
-- sections: depends on workspace_members and section_access
-- ----------------------------------------------------------------------------
create policy "sections_select" on public.sections
  for select using (
    -- Owner/admin sees all sections in their workspaces
    workspace_id in (
      select workspace_id from public.workspace_members
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
    or
    -- Members see sections they have explicit access to
    id in (
      select section_id from public.section_access
      where member_id in (
        select id from public.workspace_members where user_id = auth.uid()
      )
    )
  );

create policy "sections_insert" on public.sections
  for insert with check (
    workspace_id in (
      select workspace_id from public.workspace_members where user_id = auth.uid()
    )
  );

create policy "sections_update" on public.sections
  for update using (
    workspace_id in (
      select workspace_id from public.workspace_members
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
  );

create policy "sections_delete" on public.sections
  for delete using (
    workspace_id in (
      select workspace_id from public.workspace_members
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
  );

-- ----------------------------------------------------------------------------
-- section_access: uses denormalized workspace_id to avoid querying sections
-- ----------------------------------------------------------------------------
create policy "section_access_select" on public.section_access
  for select using (
    -- See your own access
    member_id in (select id from public.workspace_members where user_id = auth.uid())
    or
    -- Owner/admin sees all (uses denormalized workspace_id)
    workspace_id in (
      select workspace_id from public.workspace_members
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
  );

create policy "section_access_insert" on public.section_access
  for insert with check (
    -- Get workspace_id from section, check ownership
    -- Note: trigger will populate workspace_id before this runs
    section_id in (
      select s.id from public.sections s
      where s.workspace_id in (
        select workspace_id from public.workspace_members
        where user_id = auth.uid() and role in ('owner', 'admin')
      )
    )
  );

create policy "section_access_delete" on public.section_access
  for delete using (
    workspace_id in (
      select workspace_id from public.workspace_members
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
  );

-- ============================================================================
-- STEP 5: Indexes for performance
-- ============================================================================
create index if not exists idx_workspace_members_user_role
  on public.workspace_members(user_id, role);
create index if not exists idx_workspace_members_workspace_role
  on public.workspace_members(workspace_id, role);
create index if not exists idx_section_access_workspace
  on public.section_access(workspace_id);
