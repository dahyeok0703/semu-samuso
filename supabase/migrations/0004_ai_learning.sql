-- ============================================================================
-- 0004_ai_learning
-- classification_history — the learning loop (RAG). Every confirmed/corrected
--   document classification is accumulated PER WORKSPACE and must NEVER leak to
--   another workspace (strict select isolation below).
-- ai_usage — per-workspace, per-month AI cost accounting (margin protection).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- classification_history
-- ----------------------------------------------------------------------------
create table public.classification_history (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references public.workspaces (id) on delete cascade,
  client_id           uuid not null references public.clients (id) on delete cascade,
  doc_type            text not null,              -- 최종 확정된 분류
  account_hint        text,                       -- 추천 계정과목 힌트 (nullable)
  features            jsonb not null default '{}'::jsonb, -- 발행처명/금액대/키워드 등 검색용
  was_corrected       boolean not null default false,     -- 사용자가 AI 결과를 교정했는지
  source_document_id  uuid references public.documents (id) on delete set null,
  confirmed_at        timestamptz not null default now(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index classification_history_workspace_id_idx on public.classification_history (workspace_id);
create index classification_history_client_id_idx on public.classification_history (client_id);
create index classification_history_doc_type_idx on public.classification_history (workspace_id, doc_type);
-- GIN index over features for similarity/keyword lookups during RAG retrieval.
create index classification_history_features_idx on public.classification_history using gin (features);

create trigger classification_history_set_updated_at
  before update on public.classification_history
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- ai_usage
-- ----------------------------------------------------------------------------
create table public.ai_usage (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references public.workspaces (id) on delete cascade,
  month          date not null,                 -- 해당 월의 1일로 저장
  input_tokens   bigint not null default 0,
  output_tokens  bigint not null default 0,
  doc_count      integer not null default 0,
  est_cost_krw   numeric(14, 2) not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (workspace_id, month)
);

create index ai_usage_workspace_id_idx on public.ai_usage (workspace_id);

create trigger ai_usage_set_updated_at
  before update on public.ai_usage
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- RLS
--   classification_history: read/write strictly within the caller's workspace.
--     INSERT allowed for owner or members assigned to the client (they confirm
--     classifications); edits/deletes are owner-only. NEVER readable across
--     workspaces — the select policy pins workspace_id = current_workspace_id().
--   ai_usage: owner read-only. Inserts/updates come from the service role
--     (usage aggregation jobs), which bypasses RLS — no write policy is granted
--     to authenticated, so members can never tamper with cost records.
-- ----------------------------------------------------------------------------
alter table public.classification_history enable row level security;
alter table public.ai_usage enable row level security;

create policy "classification_history_select" on public.classification_history
  for select using (workspace_id = public.current_workspace_id());
create policy "classification_history_insert_scoped" on public.classification_history
  for insert with check (
    workspace_id = public.current_workspace_id()
    and (public.is_owner() or public.is_assigned_to_client(client_id))
  );
create policy "classification_history_update_owner" on public.classification_history
  for update using (workspace_id = public.current_workspace_id() and public.is_owner())
  with check (workspace_id = public.current_workspace_id() and public.is_owner());
create policy "classification_history_delete_owner" on public.classification_history
  for delete using (workspace_id = public.current_workspace_id() and public.is_owner());

-- ai_usage: owners can read their workspace's numbers; no member write path.
create policy "ai_usage_select_owner" on public.ai_usage
  for select using (workspace_id = public.current_workspace_id() and public.is_owner());

grant select, insert, update, delete on public.classification_history to authenticated, service_role;
-- authenticated may only SELECT ai_usage; writes are reserved for service_role.
grant select on public.ai_usage to authenticated;
grant select, insert, update, delete on public.ai_usage to service_role;
