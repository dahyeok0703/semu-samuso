-- ============================================================================
-- 0001_core
-- Multi-tenancy core: workspace (사무소) + member (직원) + RLS helper functions.
--
-- Tenancy model (see CLAUDE.md):
--   workspace (사무소) → member (직원, owner/staff) → everything else.
-- EVERY tenant table carries workspace_id and is isolated by RLS keyed off the
-- caller's current workspace. Helper functions are SECURITY DEFINER (owned by
-- the migration superuser) so they bypass RLS internally — this both prevents
-- policy recursion and guarantees a member can never probe another workspace.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------
create type public.workspace_plan as enum ('free', 'team', 'pro');
create type public.member_role as enum ('owner', 'staff');
create type public.member_status as enum ('active', 'inactive');

-- ----------------------------------------------------------------------------
-- workspaces (사무소) — the tenant root.
-- ----------------------------------------------------------------------------
create table public.workspaces (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null check (char_length(trim(name)) > 0),
  plan                 public.workspace_plan not null default 'free',
  trial_ends_at        timestamptz,
  billing_customer_id  text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- members (직원) — links an auth user (or a pending invite) to a workspace.
-- user_id is null for invited-but-not-yet-accepted members.
-- ----------------------------------------------------------------------------
create table public.members (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references public.workspaces (id) on delete cascade,
  user_id        uuid references auth.users (id) on delete set null,
  name           text not null check (char_length(trim(name)) > 0),
  role           public.member_role not null default 'staff',
  status         public.member_status not null default 'active',
  invited_email  text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index members_workspace_id_idx on public.members (workspace_id);
-- A given auth user maps to exactly one member row (one workspace per user for now).
create unique index members_user_id_key on public.members (user_id) where user_id is not null;

-- ----------------------------------------------------------------------------
-- updated_at maintenance (reused by every table).
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
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
-- RLS helper functions. SECURITY DEFINER + locked search_path. They resolve the
-- caller (auth.uid()) to their single active member row and answer the
-- questions every policy needs. Because they are definer-owned they bypass RLS
-- on the tables they read, which avoids recursive policy evaluation.
-- ----------------------------------------------------------------------------

-- The caller's active member row (or null).
create or replace function public.current_member()
returns public.members
language sql
stable
security definer
set search_path = ''
as $$
  select m.*
  from public.members m
  where m.user_id = auth.uid()
    and m.status = 'active'
  limit 1;
$$;

create or replace function public.current_workspace_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.workspace_id
  from public.members m
  where m.user_id = auth.uid()
    and m.status = 'active'
  limit 1;
$$;

create or replace function public.current_member_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.id
  from public.members m
  where m.user_id = auth.uid()
    and m.status = 'active'
  limit 1;
$$;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.members m
    where m.user_id = auth.uid()
      and m.status = 'active'
      and m.role = 'owner'
  );
$$;

-- True when the caller is assigned to the given client (staff write scoping).
-- plpgsql so the body is not validated against client_assignments at creation
-- time (that table is created in a later migration).
create or replace function public.is_assigned_to_client(_client_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return exists (
    select 1
    from public.client_assignments ca
    where ca.client_id = _client_id
      and ca.member_id = public.current_member_id()
  );
end;
$$;

-- True when the caller may write a filing task: owner, the task's assignee, or
-- a member assigned to the task's client. plpgsql for the same forward-reference
-- reason (filing_tasks is created later).
create or replace function public.can_write_task(_task_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return public.is_owner() or exists (
    select 1
    from public.filing_tasks t
    where t.id = _task_id
      and (
        t.assigned_member_id = public.current_member_id()
        or public.is_assigned_to_client(t.client_id)
      )
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- Signup hook: create one workspace + register the user as its owner.
-- Runs as SECURITY DEFINER on auth.users insert (bypasses RLS).
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _workspace_id uuid;
  _office_name  text;
  _name         text;
begin
  _office_name := coalesce(nullif(trim(new.raw_user_meta_data ->> 'office_name'), ''), '내 사무소');
  _name := coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1));

  insert into public.workspaces (name, plan, trial_ends_at)
  values (_office_name, 'free', now() + interval '14 days')
  returning id into _workspace_id;

  insert into public.members (workspace_id, user_id, name, role, status)
  values (_workspace_id, new.id, _name, 'owner', 'active');

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------
alter table public.workspaces enable row level security;
alter table public.members enable row level security;

-- workspaces: members read their own workspace; only owners may modify it.
create policy "workspaces_select" on public.workspaces
  for select using (id = public.current_workspace_id());
create policy "workspaces_update_owner" on public.workspaces
  for update using (id = public.current_workspace_id() and public.is_owner())
  with check (id = public.current_workspace_id() and public.is_owner());
create policy "workspaces_delete_owner" on public.workspaces
  for delete using (id = public.current_workspace_id() and public.is_owner());

-- members: everyone in the workspace can read the roster; only owners write it.
create policy "members_select" on public.members
  for select using (workspace_id = public.current_workspace_id());
create policy "members_insert_owner" on public.members
  for insert with check (workspace_id = public.current_workspace_id() and public.is_owner());
create policy "members_update_owner" on public.members
  for update using (workspace_id = public.current_workspace_id() and public.is_owner())
  with check (workspace_id = public.current_workspace_id() and public.is_owner());
create policy "members_delete_owner" on public.members
  for delete using (workspace_id = public.current_workspace_id() and public.is_owner());

-- ----------------------------------------------------------------------------
-- Grants. RLS gates rows; these grant the base table privileges. anon gets
-- nothing. service_role bypasses RLS (BYPASSRLS) for system/back-office jobs.
-- ----------------------------------------------------------------------------
grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on public.workspaces to authenticated, service_role;
grant select, insert, update, delete on public.members to authenticated, service_role;
grant execute on function
  public.current_member(),
  public.current_workspace_id(),
  public.current_member_id(),
  public.is_owner(),
  public.is_assigned_to_client(uuid),
  public.can_write_task(uuid)
  to authenticated, service_role;
