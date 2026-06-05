-- ============================================================================
-- 0007_documents_ai_storage
-- AI-classification metadata on documents + a private Storage bucket for
-- collected files, isolated per workspace by object-path prefix.
-- ============================================================================

alter table public.documents
  add column ai_model text,                              -- model that produced the suggestion
  add column ai_meta jsonb not null default '{}'::jsonb; -- vendor/amount/period/reasoning, RAG hit ids

-- ----------------------------------------------------------------------------
-- Storage bucket (private). Object path convention:
--   "<workspace_id>/<client_id>/<uuid>-<filename>"
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- RLS on storage.objects: a member may read/write ONLY objects whose first
-- path segment is their own workspace id. This keeps files workspace-isolated
-- at the storage layer, mirroring the table-level RLS.
create policy "documents_objects_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = public.current_workspace_id()::text
  );

create policy "documents_objects_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = public.current_workspace_id()::text
  );

create policy "documents_objects_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = public.current_workspace_id()::text
  )
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = public.current_workspace_id()::text
  );

create policy "documents_objects_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = public.current_workspace_id()::text
  );
