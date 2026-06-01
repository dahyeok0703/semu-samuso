-- ============================================================================
-- 0001_workspaces_and_members
-- Multi-tenancy core: workspace (사무소) -> member (직원).
-- Every tenant-scoped table in this project carries workspace_id and is
-- protected by RLS keyed off membership (see CLAUDE.md).
-- ============================================================================

-- Roles a member can hold within a workspace.
create type public.member_role as enum ('owner', 'staff');

-- ----------------------------------------------------------------------------
-- workspaces (사무소): the top-level tenant.
-- ----------------------------------------------------------------------------
create table public.workspaces (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(trim(name)) > 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- members (직원): links an auth user to a workspace with a role.
-- ----------------------------------------------------------------------------
create table public.members (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,
  role          public.member_role not null default 'staff',
  display_name  text not null check (char_length(trim(display_name)) > 0),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create index members_user_id_idx on public.members (user_id);
create index members_workspace_id_idx on public.members (workspace_id);

-- ----------------------------------------------------------------------------
-- Helper functions. SECURITY DEFINER + owned by postgres so they bypass RLS on
-- `members`, which prevents infinite-recursion in the members RLS policies.
-- ----------------------------------------------------------------------------
create or replace function public.is_workspace_member(_workspace_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.members m
    where m.workspace_id = _workspace_id
      and m.user_id = auth.uid()
  );
$$;

create or replace function public.workspace_role(_workspace_id uuid)
returns public.member_role
language sql
security definer
set search_path = public
stable
as $$
  select m.role
  from public.members m
  where m.workspace_id = _workspace_id
    and m.user_id = auth.uid();
$$;

-- ----------------------------------------------------------------------------
-- updated_at maintenance.
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger workspaces_set_updated_at
  before update on public.workspaces
  for each row execute function public.set_updated_at();

create trigger members_set_updated_at
  before update on public.members
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- On signup: auto-create one workspace and register the user as its owner.
-- Runs as SECURITY DEFINER on the auth.users insert.
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _workspace_id uuid;
  _office_name  text;
  _display_name text;
begin
  _office_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'office_name'), ''),
    '내 사무소'
  );
  _display_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    split_part(new.email, '@', 1)
  );

  insert into public.workspaces (name)
  values (_office_name)
  returning id into _workspace_id;

  insert into public.members (workspace_id, user_id, role, display_name)
  values (_workspace_id, new.id, 'owner', _display_name);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- Row Level Security.
-- ----------------------------------------------------------------------------
alter table public.workspaces enable row level security;
alter table public.members enable row level security;

-- workspaces: members can read; only owners can rename/delete.
create policy "workspaces_select_member"
  on public.workspaces for select
  using (public.is_workspace_member(id));

create policy "workspaces_update_owner"
  on public.workspaces for update
  using (public.workspace_role(id) = 'owner')
  with check (public.workspace_role(id) = 'owner');

create policy "workspaces_delete_owner"
  on public.workspaces for delete
  using (public.workspace_role(id) = 'owner');

-- members: anyone in the workspace can see the roster.
create policy "members_select_member"
  on public.members for select
  using (public.is_workspace_member(workspace_id));

-- members: owners manage the roster. (Self-insert is handled by the signup
-- trigger, which runs as definer and bypasses these policies.)
create policy "members_insert_owner"
  on public.members for insert
  with check (public.workspace_role(workspace_id) = 'owner');

create policy "members_update_owner"
  on public.members for update
  using (public.workspace_role(workspace_id) = 'owner')
  with check (public.workspace_role(workspace_id) = 'owner');

create policy "members_delete_owner"
  on public.members for delete
  using (public.workspace_role(workspace_id) = 'owner');
