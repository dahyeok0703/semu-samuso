-- ============================================================================
-- 0002_clients
-- clients (거래처) and the N:N member assignment that scopes staff write access.
-- ============================================================================

create type public.tax_type as enum ('general', 'simplified', 'exempt', 'corporate');
create type public.client_status as enum ('active', 'paused', 'ended');

create table public.clients (
  id                        uuid primary key default gen_random_uuid(),
  workspace_id              uuid not null references public.workspaces (id) on delete cascade,
  biz_name                  text not null check (char_length(trim(biz_name)) > 0), -- 상호
  biz_reg_no                text,                 -- 사업자등록번호
  ceo_name                  text,                 -- 대표자명
  industry                  text,                 -- 업종
  tax_type                  public.tax_type,      -- 과세유형
  closing_month             int not null default 12 check (closing_month between 1 and 12), -- 결산월
  is_semiannual_withholding boolean not null default false, -- 반기 원천징수 대상
  is_diligent_filing        boolean not null default false, -- 성실신고 대상
  contact_phone             text,
  contact_kakao             text,
  contact_email             text,
  status                    public.client_status not null default 'active',
  memo                      text,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create index clients_workspace_id_idx on public.clients (workspace_id);
create index clients_status_idx on public.clients (workspace_id, status);
create unique index clients_workspace_biz_reg_no_key
  on public.clients (workspace_id, biz_reg_no)
  where biz_reg_no is not null;

create trigger clients_set_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- client_assignments (담당 배정) — which members handle which clients (N:N).
-- ----------------------------------------------------------------------------
create table public.client_assignments (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  client_id     uuid not null references public.clients (id) on delete cascade,
  member_id     uuid not null references public.members (id) on delete cascade,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (client_id, member_id)
);

create index client_assignments_workspace_id_idx on public.client_assignments (workspace_id);
create index client_assignments_member_id_idx on public.client_assignments (member_id);
create index client_assignments_client_id_idx on public.client_assignments (client_id);

create trigger client_assignments_set_updated_at
  before update on public.client_assignments
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- RLS
--   read  : any member of the workspace
--   write : owner anywhere; staff only on clients they are assigned to.
-- ----------------------------------------------------------------------------
alter table public.clients enable row level security;
alter table public.client_assignments enable row level security;

-- clients
create policy "clients_select" on public.clients
  for select using (workspace_id = public.current_workspace_id());
create policy "clients_insert_owner" on public.clients
  for insert with check (workspace_id = public.current_workspace_id() and public.is_owner());
create policy "clients_update_scoped" on public.clients
  for update using (
    workspace_id = public.current_workspace_id()
    and (public.is_owner() or public.is_assigned_to_client(id))
  )
  with check (
    workspace_id = public.current_workspace_id()
    and (public.is_owner() or public.is_assigned_to_client(id))
  );
create policy "clients_delete_owner" on public.clients
  for delete using (workspace_id = public.current_workspace_id() and public.is_owner());

-- client_assignments: owners manage the assignment matrix; all members read it.
create policy "client_assignments_select" on public.client_assignments
  for select using (workspace_id = public.current_workspace_id());
create policy "client_assignments_insert_owner" on public.client_assignments
  for insert with check (workspace_id = public.current_workspace_id() and public.is_owner());
create policy "client_assignments_update_owner" on public.client_assignments
  for update using (workspace_id = public.current_workspace_id() and public.is_owner())
  with check (workspace_id = public.current_workspace_id() and public.is_owner());
create policy "client_assignments_delete_owner" on public.client_assignments
  for delete using (workspace_id = public.current_workspace_id() and public.is_owner());

grant select, insert, update, delete on public.clients to authenticated, service_role;
grant select, insert, update, delete on public.client_assignments to authenticated, service_role;
