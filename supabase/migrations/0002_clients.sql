-- ============================================================================
-- 0002_clients
-- clients (거래처): the businesses a tax office is engaged to serve.
-- Tenant-scoped by workspace_id, protected by RLS via membership.
-- ============================================================================

-- 과세유형 (tax classification).
create type public.tax_type as enum (
  'general',     -- 일반과세자
  'simplified',  -- 간이과세자
  'exempt',      -- 면세사업자
  'corporate'    -- 법인사업자
);

-- Engagement (수임) status of the client relationship.
create type public.client_status as enum ('active', 'suspended', 'terminated');

create table public.clients (
  id                   uuid primary key default gen_random_uuid(),
  workspace_id         uuid not null references public.workspaces (id) on delete cascade,
  name                 text not null check (char_length(trim(name)) > 0), -- 상호 / 거래처명
  business_number      text,        -- 사업자등록번호 (10 digits, formatting handled in app)
  representative_name  text,        -- 대표자명
  tax_type             public.tax_type,
  status               public.client_status not null default 'active',
  email                text,
  phone                text,
  memo                 text,
  created_by           uuid references auth.users (id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index clients_workspace_id_idx on public.clients (workspace_id);
create index clients_status_idx on public.clients (workspace_id, status);

-- Business registration numbers are unique per workspace when present.
create unique index clients_workspace_business_number_key
  on public.clients (workspace_id, business_number)
  where business_number is not null;

create trigger clients_set_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- RLS: scoped strictly to the owning workspace.
-- ----------------------------------------------------------------------------
alter table public.clients enable row level security;

create policy "clients_select_member"
  on public.clients for select
  using (public.is_workspace_member(workspace_id));

create policy "clients_insert_member"
  on public.clients for insert
  with check (public.is_workspace_member(workspace_id));

create policy "clients_update_member"
  on public.clients for update
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

-- Only owners may permanently delete a client record.
create policy "clients_delete_owner"
  on public.clients for delete
  using (public.workspace_role(workspace_id) = 'owner');
