-- ============================================================================
-- Cost-metering RLS (pgTAP).
--   - margin_flags: 내부 전용. authenticated 권한 자체 없음(service_role 만).
--   - classification_jobs: 워크스페이스 범위 조회/삽입, 타 워크스페이스 차단.
-- ============================================================================
begin;
create extension if not exists pgtap;
select plan(6);

alter table auth.users disable trigger on_auth_user_created;

insert into auth.users (id, email) values
  ('c0000000-0000-0000-0000-000000000001', 'ownerA@a.com'),
  ('c0000000-0000-0000-0000-000000000002', 'ownerB@b.com');

insert into public.workspaces (id, name) values
  ('cccccccc-1111-1111-1111-111111111111', '사무소 A'),
  ('dddddddd-2222-2222-2222-222222222222', '사무소 B');

insert into public.members (id, workspace_id, user_id, name, role, status) values
  ('c1000000-0000-0000-0000-000000000001', 'cccccccc-1111-1111-1111-111111111111',
   'c0000000-0000-0000-0000-000000000001', '대표A', 'owner', 'active'),
  ('c1000000-0000-0000-0000-000000000002', 'dddddddd-2222-2222-2222-222222222222',
   'c0000000-0000-0000-0000-000000000002', '대표B', 'owner', 'active');

-- A document in workspace A (for classification_jobs FK).
insert into public.clients (id, workspace_id, biz_name, tax_type)
  values ('c2000000-0000-0000-0000-000000000001', 'cccccccc-1111-1111-1111-111111111111', '거래처A', 'general');
insert into public.documents (id, workspace_id, client_id, file_path, source)
  values ('c3000000-0000-0000-0000-000000000001', 'cccccccc-1111-1111-1111-111111111111',
          'c2000000-0000-0000-0000-000000000001', 'cccccccc-1111-1111-1111-111111111111/doc.pdf', 'upload');

insert into public.margin_flags (workspace_id, month, mrr_krw, cogs_krw, margin_rate, flagged)
  values ('cccccccc-1111-1111-1111-111111111111', date_trunc('month', now())::date, 9900, 8000, 0.19, true);

set local role authenticated;

-- owner A cannot read internal margin_flags (no authenticated grant at all)
select set_config('request.jwt.claim.sub', 'c0000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.email', 'ownerA@a.com', true);
select throws_ok(
  $$select count(*) from public.margin_flags$$,
  '42501', null, 'margin_flags is internal-only (no authenticated access)');

-- owner A can enqueue a classification job in their workspace
select lives_ok(
  $$insert into public.classification_jobs (workspace_id, document_id, custom_id, status)
    values ('cccccccc-1111-1111-1111-111111111111','c3000000-0000-0000-0000-000000000001','cid-1','pending')$$,
  'owner can enqueue a classification job in own workspace');

-- and read it back
select is((select count(*)::int from public.classification_jobs), 1,
  'owner sees own workspace jobs');

-- owner A cannot enqueue a job for workspace B (RLS check violation)
select throws_ok(
  $$insert into public.classification_jobs (workspace_id, document_id, custom_id, status)
    values ('dddddddd-2222-2222-2222-222222222222','c3000000-0000-0000-0000-000000000001','cid-2','pending')$$,
  '42501', null, 'cannot enqueue a job for another workspace');

-- owner B cannot see workspace A jobs (isolation)
select set_config('request.jwt.claim.sub', 'c0000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claim.email', 'ownerB@b.com', true);
select is((select count(*)::int from public.classification_jobs), 0,
  'owner B cannot see A jobs');

reset role;

-- service role can read internal margin_flags
set local role service_role;
select is((select count(*)::int from public.margin_flags), 1,
  'service role reads margin_flags');

reset role;
select * from finish();
rollback;
