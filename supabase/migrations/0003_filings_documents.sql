-- ============================================================================
-- 0003_filings_documents
-- filing_tasks (신고), expected_documents (제출 예정 서류 체크리스트),
-- documents (수집된 서류). Staff writes are scoped to assigned clients / tasks.
-- ============================================================================

create type public.filing_status as enum ('pending', 'docs_received', 'filed', 'done');
create type public.docs_status as enum ('missing', 'partial', 'complete');
create type public.document_source as enum ('upload', 'email', 'kakao', 'codef');
create type public.document_status as enum ('pending_review', 'confirmed');

-- ----------------------------------------------------------------------------
-- filing_tasks (신고/마감 업무)
-- ----------------------------------------------------------------------------
create table public.filing_tasks (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references public.workspaces (id) on delete cascade,
  client_id           uuid not null references public.clients (id) on delete cascade,
  filing_type         text not null,                 -- 예: vat_1, vat_2, income, corporate, withholding
  period_label        text not null,                 -- 예: 2025-1기, 2025년 귀속
  due_date            date,
  status              public.filing_status not null default 'pending',
  docs_status         public.docs_status not null default 'missing',
  assigned_member_id  uuid references public.members (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index filing_tasks_workspace_id_idx on public.filing_tasks (workspace_id);
create index filing_tasks_client_id_idx on public.filing_tasks (client_id);
create index filing_tasks_assigned_member_idx on public.filing_tasks (assigned_member_id);
create index filing_tasks_due_date_idx on public.filing_tasks (workspace_id, due_date);

create trigger filing_tasks_set_updated_at
  before update on public.filing_tasks
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- expected_documents — per-task checklist used to detect missing docs.
-- ----------------------------------------------------------------------------
create table public.expected_documents (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.workspaces (id) on delete cascade,
  filing_task_id  uuid not null references public.filing_tasks (id) on delete cascade,
  doc_type        text not null,
  is_received     boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (filing_task_id, doc_type)
);

create index expected_documents_workspace_id_idx on public.expected_documents (workspace_id);
create index expected_documents_task_idx on public.expected_documents (filing_task_id);

create trigger expected_documents_set_updated_at
  before update on public.expected_documents
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- documents — collected files (uploaded, emailed, kakao, codef scrape).
-- ----------------------------------------------------------------------------
create table public.documents (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references public.workspaces (id) on delete cascade,
  client_id        uuid not null references public.clients (id) on delete cascade,
  filing_task_id   uuid references public.filing_tasks (id) on delete set null,
  doc_type         text,
  file_path        text not null,
  source           public.document_source not null default 'upload',
  classified_by_ai boolean not null default false,
  confidence       numeric(5, 4) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  status           public.document_status not null default 'pending_review',
  received_at      timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index documents_workspace_id_idx on public.documents (workspace_id);
create index documents_client_id_idx on public.documents (client_id);
create index documents_task_idx on public.documents (filing_task_id);
create index documents_status_idx on public.documents (workspace_id, status);

create trigger documents_set_updated_at
  before update on public.documents
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- RLS
--   read  : any member of the workspace
--   write : owner anywhere; staff scoped to assigned clients / tasks.
-- ----------------------------------------------------------------------------
alter table public.filing_tasks enable row level security;
alter table public.expected_documents enable row level security;
alter table public.documents enable row level security;

-- filing_tasks
create policy "filing_tasks_select" on public.filing_tasks
  for select using (workspace_id = public.current_workspace_id());
create policy "filing_tasks_insert_scoped" on public.filing_tasks
  for insert with check (
    workspace_id = public.current_workspace_id()
    and (public.is_owner() or public.is_assigned_to_client(client_id))
  );
create policy "filing_tasks_update_scoped" on public.filing_tasks
  for update using (
    workspace_id = public.current_workspace_id()
    and (
      public.is_owner()
      or assigned_member_id = public.current_member_id()
      or public.is_assigned_to_client(client_id)
    )
  )
  with check (
    workspace_id = public.current_workspace_id()
    and (
      public.is_owner()
      or assigned_member_id = public.current_member_id()
      or public.is_assigned_to_client(client_id)
    )
  );
create policy "filing_tasks_delete_owner" on public.filing_tasks
  for delete using (workspace_id = public.current_workspace_id() and public.is_owner());

-- expected_documents (scoped via the parent task)
create policy "expected_documents_select" on public.expected_documents
  for select using (workspace_id = public.current_workspace_id());
create policy "expected_documents_insert_scoped" on public.expected_documents
  for insert with check (
    workspace_id = public.current_workspace_id() and public.can_write_task(filing_task_id)
  );
create policy "expected_documents_update_scoped" on public.expected_documents
  for update using (
    workspace_id = public.current_workspace_id() and public.can_write_task(filing_task_id)
  )
  with check (
    workspace_id = public.current_workspace_id() and public.can_write_task(filing_task_id)
  );
create policy "expected_documents_delete_owner" on public.expected_documents
  for delete using (workspace_id = public.current_workspace_id() and public.is_owner());

-- documents (scoped via the client)
create policy "documents_select" on public.documents
  for select using (workspace_id = public.current_workspace_id());
create policy "documents_insert_scoped" on public.documents
  for insert with check (
    workspace_id = public.current_workspace_id()
    and (public.is_owner() or public.is_assigned_to_client(client_id))
  );
create policy "documents_update_scoped" on public.documents
  for update using (
    workspace_id = public.current_workspace_id()
    and (public.is_owner() or public.is_assigned_to_client(client_id))
  )
  with check (
    workspace_id = public.current_workspace_id()
    and (public.is_owner() or public.is_assigned_to_client(client_id))
  );
create policy "documents_delete_owner" on public.documents
  for delete using (workspace_id = public.current_workspace_id() and public.is_owner());

grant select, insert, update, delete on public.filing_tasks to authenticated, service_role;
grant select, insert, update, delete on public.expected_documents to authenticated, service_role;
grant select, insert, update, delete on public.documents to authenticated, service_role;
