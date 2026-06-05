-- ============================================================================
-- 0009_team_invitations
-- Email invitations so an owner can add staff to the workspace. Acceptance is
-- RLS-driven (no service role required): the invited user reads/accepts their
-- own invite by email, and may insert exactly one staff member row for itself.
-- ============================================================================

create type public.invitation_status as enum ('pending', 'accepted', 'revoked');

create table public.invitations (
  id                    uuid primary key default gen_random_uuid(),
  workspace_id          uuid not null references public.workspaces (id) on delete cascade,
  email                 text not null,
  role                  public.member_role not null default 'staff',
  token                 text not null unique,
  status                public.invitation_status not null default 'pending',
  invited_by_member_id  uuid references public.members (id) on delete set null,
  expires_at            timestamptz not null default (now() + interval '14 days'),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index invitations_workspace_id_idx on public.invitations (workspace_id);
create index invitations_email_idx on public.invitations (lower(email));
-- At most one pending invite per (workspace, email).
create unique index invitations_pending_key
  on public.invitations (workspace_id, lower(email))
  where status = 'pending';

create trigger invitations_set_updated_at
  before update on public.invitations
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Signup hook: skip auto-creating a workspace for users joining via invite
-- (their staff member row is created on acceptance instead).
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
  -- Invited users do not get their own workspace.
  if coalesce(new.raw_user_meta_data ->> 'skip_workspace', '') = 'true' then
    return new;
  end if;

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

-- ----------------------------------------------------------------------------
-- RLS
--   invitations: owner manages; the invited user can read/accept their own
--                invite (matched by email from the JWT).
--   members:     plus the existing owner policies, a user may insert exactly
--                one ACTIVE STAFF row for THEMSELVES when a matching pending
--                invitation exists — this is the accept path (no escalation:
--                role/status are pinned).
-- ----------------------------------------------------------------------------
alter table public.invitations enable row level security;

create policy "invitations_select" on public.invitations
  for select using (
    (workspace_id = public.current_workspace_id() and public.is_owner())
    or lower(email) = lower(coalesce(auth.email(), ''))
  );
create policy "invitations_insert_owner" on public.invitations
  for insert with check (workspace_id = public.current_workspace_id() and public.is_owner());
create policy "invitations_update" on public.invitations
  for update using (
    (workspace_id = public.current_workspace_id() and public.is_owner())
    or lower(email) = lower(coalesce(auth.email(), ''))
  )
  with check (
    (workspace_id = public.current_workspace_id() and public.is_owner())
    or lower(email) = lower(coalesce(auth.email(), ''))
  );
create policy "invitations_delete_owner" on public.invitations
  for delete using (workspace_id = public.current_workspace_id() and public.is_owner());

create policy "members_insert_self_invited" on public.members
  for insert with check (
    user_id = auth.uid()
    and role = 'staff'
    and status = 'active'
    and exists (
      select 1
      from public.invitations i
      where i.workspace_id = members.workspace_id
        and i.status = 'pending'
        and i.expires_at > now()
        and lower(i.email) = lower(coalesce(auth.email(), ''))
    )
  );

grant select, insert, update, delete on public.invitations to authenticated, service_role;
