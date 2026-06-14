-- ============================================================================
-- 0014_integrations
-- 선택 외부 연동의 워크스페이스별 설정(토글 + 키). 키는 민감정보이므로
-- billing_accounts 와 동일하게 **service_role 전용**(authenticated 정책/권한 없음).
-- 화면에는 설정 여부/끝자리 등 비민감 상태만 server action 으로 노출한다.
--
-- 연동은 lib/integrations/ 아래로 격리되며, 키/토글이 없으면 자동 비활성(핵심 동작 무영향).
-- ============================================================================

create type public.integration_provider as enum ('solapi', 'codef', 'erp_import');

create table public.integration_settings (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  provider      public.integration_provider not null,
  enabled       boolean not null default false,
  config        jsonb not null default '{}'::jsonb, -- 민감 키 (service-role only)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (workspace_id, provider)
);

create index integration_settings_workspace_idx on public.integration_settings (workspace_id);

create trigger integration_settings_set_updated_at
  before update on public.integration_settings
  for each row execute function public.set_updated_at();

-- RLS: 내부/민감 — authenticated 정책 없음. service_role 만 읽기/쓰기.
alter table public.integration_settings enable row level security;

grant select, insert, update, delete on public.integration_settings to service_role;
