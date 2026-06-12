-- ============================================================================
-- 0012_cost_metering
-- 비용 계측 + 마진 보호.
--   - ai_usage 에 캐시/오버리지 컬럼 추가(정밀 원가 집계)
--   - workspaces.ai_quota_policy: 쿼터 초과 시 동작(하드캡/오버리지) override
--   - margin_flags: 워크스페이스·월별 마진 < 목표치 자동 플래그(내부 전용)
--   - classification_jobs: Batch API(50% 할인) 분류 대기열 추적
-- 단가/쿼터/목표마진은 코드 설정(src/lib/pricing/cogs.ts)으로 관리한다.
-- ============================================================================

-- 쿼터 초과 동작: 하드캡(분류 중단→수동) 또는 오버리지(문서당 자동 과금)
create type public.ai_quota_policy as enum ('hardcap', 'overage');

-- ----------------------------------------------------------------------------
-- ai_usage: 정밀 원가 집계용 컬럼.
-- ----------------------------------------------------------------------------
alter table public.ai_usage
  add column cache_read_tokens bigint not null default 0,
  add column overage_docs      integer not null default 0,
  add column overage_cost_krw  numeric(14, 2) not null default 0;

-- ----------------------------------------------------------------------------
-- workspaces: 쿼터 초과 정책 override (null → 플랜 기본값, cogs.ts).
-- ----------------------------------------------------------------------------
alter table public.workspaces
  add column ai_quota_policy public.ai_quota_policy;

-- ----------------------------------------------------------------------------
-- margin_flags — 내부(슈퍼유저) 전용 마진 모니터. service_role 만 기록/조회.
-- authenticated 정책 없음(빌링키와 동일하게 내부 지표는 노출 금지).
-- ----------------------------------------------------------------------------
create table public.margin_flags (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  month         date not null,
  mrr_krw       numeric(14, 2) not null default 0,
  cogs_krw      numeric(14, 2) not null default 0,
  margin_rate   numeric(6, 4),                       -- 0~1, 매출 0이면 null
  flagged       boolean not null default false,
  notified_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (workspace_id, month)
);

create index margin_flags_flagged_idx on public.margin_flags (month, flagged);

create trigger margin_flags_set_updated_at
  before update on public.margin_flags
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- classification_jobs — Batch API 분류 대기열. 멤버가 enqueue(insert), 하베스트
-- 크론이 service_role 로 결과 반영(update). 워크스페이스 범위로 조회 가능.
-- ----------------------------------------------------------------------------
create table public.classification_jobs (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  document_id   uuid not null references public.documents (id) on delete cascade,
  batch_id      text,                                  -- provider message-batch id
  custom_id     text not null,                         -- per-item id in the batch
  status        text not null default 'pending',       -- pending|submitted|done|failed
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index classification_jobs_workspace_idx on public.classification_jobs (workspace_id);
create index classification_jobs_batch_idx on public.classification_jobs (batch_id) where batch_id is not null;
create index classification_jobs_status_idx on public.classification_jobs (status);

create trigger classification_jobs_set_updated_at
  before update on public.classification_jobs
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table public.margin_flags enable row level security;
alter table public.classification_jobs enable row level security;

-- margin_flags: authenticated 정책 없음(내부 전용). service_role 만.
grant select, insert, update, delete on public.margin_flags to service_role;

-- classification_jobs: 워크스페이스 멤버 조회, 멤버 enqueue, service_role 가 갱신.
create policy "classification_jobs_select" on public.classification_jobs
  for select using (workspace_id = public.current_workspace_id());
create policy "classification_jobs_insert" on public.classification_jobs
  for insert with check (workspace_id = public.current_workspace_id());

grant select, insert on public.classification_jobs to authenticated;
grant select, insert, update, delete on public.classification_jobs to service_role;
