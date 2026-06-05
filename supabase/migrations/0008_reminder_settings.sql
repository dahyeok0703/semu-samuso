-- ============================================================================
-- 0008_reminder_settings
-- Per-workspace reminder behaviour: auto-send toggle, preferred channels (in
-- priority order), and the D-N offsets that trigger candidates.
-- ============================================================================

create table public.reminder_settings (
  workspace_id  uuid primary key references public.workspaces (id) on delete cascade,
  auto_send     boolean not null default false,
  channels      text[] not null default array['email', 'inapp']::text[],
  offsets       integer[] not null default array[7, 3, 1]::integer[],
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger reminder_settings_set_updated_at
  before update on public.reminder_settings
  for each row execute function public.set_updated_at();

alter table public.reminder_settings enable row level security;

create policy "reminder_settings_select" on public.reminder_settings
  for select using (workspace_id = public.current_workspace_id());
create policy "reminder_settings_insert_owner" on public.reminder_settings
  for insert with check (workspace_id = public.current_workspace_id() and public.is_owner());
create policy "reminder_settings_update_owner" on public.reminder_settings
  for update using (workspace_id = public.current_workspace_id() and public.is_owner())
  with check (workspace_id = public.current_workspace_id() and public.is_owner());

grant select, insert, update, delete on public.reminder_settings to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- Allow members to create in-app notifications within their own workspace, so
-- the always-on "inapp" reminder channel works without the service-role key.
-- (Reading/updating notifications remains own-only; see 0005.)
-- ----------------------------------------------------------------------------
create policy "notifications_insert_workspace" on public.notifications
  for insert with check (workspace_id = public.current_workspace_id());

grant insert on public.notifications to authenticated;
