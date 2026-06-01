-- ============================================================================
-- 0005_comms_audit
-- reminders (발송 기록), notifications (인앱 알림), audit_logs (감사 로그),
-- billing_events (결제 웹훅 로그).
-- ============================================================================

create type public.reminder_channel as enum ('email', 'inapp', 'kakao', 'sms');
create type public.reminder_status as enum ('queued', 'sent', 'failed');

-- ----------------------------------------------------------------------------
-- reminders — outbound nudges to clients about documents / filings.
-- ----------------------------------------------------------------------------
create table public.reminders (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.workspaces (id) on delete cascade,
  client_id       uuid not null references public.clients (id) on delete cascade,
  filing_task_id  uuid references public.filing_tasks (id) on delete set null,
  channel         public.reminder_channel not null,
  template_key    text not null,
  sent_at         timestamptz,
  status          public.reminder_status not null default 'queued',
  error           text,
  response_note   text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index reminders_workspace_id_idx on public.reminders (workspace_id);
create index reminders_client_id_idx on public.reminders (client_id);
create index reminders_status_idx on public.reminders (workspace_id, status);

create trigger reminders_set_updated_at
  before update on public.reminders
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- notifications — per-member in-app notifications.
-- ----------------------------------------------------------------------------
create table public.notifications (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  member_id     uuid not null references public.members (id) on delete cascade,
  type          text not null,
  title         text not null,
  body          text,
  link          text,
  read_at       timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index notifications_workspace_id_idx on public.notifications (workspace_id);
create index notifications_member_unread_idx on public.notifications (member_id, read_at);

create trigger notifications_set_updated_at
  before update on public.notifications
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- audit_logs — who did what. Append-only from the app's perspective.
-- ----------------------------------------------------------------------------
create table public.audit_logs (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references public.workspaces (id) on delete cascade,
  actor_member_id  uuid references public.members (id) on delete set null,
  action           text not null,
  target_table     text,
  target_id        uuid,
  meta             jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index audit_logs_workspace_id_idx on public.audit_logs (workspace_id);
create index audit_logs_target_idx on public.audit_logs (workspace_id, target_table, target_id);

create trigger audit_logs_set_updated_at
  before update on public.audit_logs
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- billing_events — raw payment/webhook payloads per workspace.
-- ----------------------------------------------------------------------------
create table public.billing_events (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  type          text not null,
  raw           jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index billing_events_workspace_id_idx on public.billing_events (workspace_id);

create trigger billing_events_set_updated_at
  before update on public.billing_events
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- RLS
--   reminders     : read by workspace; write by owner or assigned member
--                   (service role for automated sends, which bypasses RLS).
--   notifications : a member sees and updates only their own notifications;
--                   creation is system-driven (service role).
--   audit_logs    : owner read-only; inserts via service role.
--   billing_events: owner read-only; inserts via service role.
-- ----------------------------------------------------------------------------
alter table public.reminders enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;
alter table public.billing_events enable row level security;

-- reminders
create policy "reminders_select" on public.reminders
  for select using (workspace_id = public.current_workspace_id());
create policy "reminders_insert_scoped" on public.reminders
  for insert with check (
    workspace_id = public.current_workspace_id()
    and (public.is_owner() or public.is_assigned_to_client(client_id))
  );
create policy "reminders_update_scoped" on public.reminders
  for update using (
    workspace_id = public.current_workspace_id()
    and (public.is_owner() or public.is_assigned_to_client(client_id))
  )
  with check (
    workspace_id = public.current_workspace_id()
    and (public.is_owner() or public.is_assigned_to_client(client_id))
  );
create policy "reminders_delete_owner" on public.reminders
  for delete using (workspace_id = public.current_workspace_id() and public.is_owner());

-- notifications (own only)
create policy "notifications_select_own" on public.notifications
  for select using (
    workspace_id = public.current_workspace_id() and member_id = public.current_member_id()
  );
create policy "notifications_update_own" on public.notifications
  for update using (
    workspace_id = public.current_workspace_id() and member_id = public.current_member_id()
  )
  with check (
    workspace_id = public.current_workspace_id() and member_id = public.current_member_id()
  );
create policy "notifications_delete_own" on public.notifications
  for delete using (
    workspace_id = public.current_workspace_id() and member_id = public.current_member_id()
  );

-- audit_logs (owner read-only)
create policy "audit_logs_select_owner" on public.audit_logs
  for select using (workspace_id = public.current_workspace_id() and public.is_owner());

-- billing_events (owner read-only)
create policy "billing_events_select_owner" on public.billing_events
  for select using (workspace_id = public.current_workspace_id() and public.is_owner());

-- Grants
grant select, insert, update, delete on public.reminders to authenticated, service_role;
-- notifications: members read/update/delete their own; creation is service-role.
grant select, update, delete on public.notifications to authenticated;
grant select, insert, update, delete on public.notifications to service_role;
-- audit_logs & billing_events: members may only SELECT (owner via RLS); writes service-role.
grant select on public.audit_logs to authenticated;
grant select, insert, update, delete on public.audit_logs to service_role;
grant select on public.billing_events to authenticated;
grant select, insert, update, delete on public.billing_events to service_role;
