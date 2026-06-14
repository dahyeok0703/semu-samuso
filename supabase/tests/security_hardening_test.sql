-- ============================================================================
-- 출시 전 보안 하드닝 — 권한/격리 통합 테스트 (pgTAP).
-- 읽기/쓰기/삭제 격리 + classification_history 누출(양방향) + 권한 우회
-- (staff 가 owner 전용/배정 외 자원에 접근/수정 불가)를 검증한다.
-- ============================================================================
begin;
create extension if not exists pgtap;
select plan(14);

alter table auth.users disable trigger on_auth_user_created;

insert into auth.users (id, email) values
  ('e0000000-0000-0000-0000-000000000001', 'ownerA@a.com'),
  ('e0000000-0000-0000-0000-000000000002', 'staffA@a.com'),
  ('e0000000-0000-0000-0000-000000000003', 'ownerB@b.com');

insert into public.workspaces (id, name) values
  ('aaaa1111-1111-1111-1111-111111111111', '사무소 A'),
  ('bbbb2222-2222-2222-2222-222222222222', '사무소 B');

insert into public.members (id, workspace_id, user_id, name, role, status) values
  ('e1000000-0000-0000-0000-000000000001', 'aaaa1111-1111-1111-1111-111111111111',
   'e0000000-0000-0000-0000-000000000001', '대표A', 'owner', 'active'),
  ('e1000000-0000-0000-0000-000000000002', 'aaaa1111-1111-1111-1111-111111111111',
   'e0000000-0000-0000-0000-000000000002', '직원A', 'staff', 'active'),
  ('e1000000-0000-0000-0000-000000000003', 'bbbb2222-2222-2222-2222-222222222222',
   'e0000000-0000-0000-0000-000000000003', '대표B', 'owner', 'active');

-- A: two clients (one assigned to staffA, one not); B: one client.
insert into public.clients (id, workspace_id, biz_name, tax_type) values
  ('c0000000-0000-0000-0000-0000000000a1', 'aaaa1111-1111-1111-1111-111111111111', '거래처A1', 'general'),
  ('c0000000-0000-0000-0000-0000000000a2', 'aaaa1111-1111-1111-1111-111111111111', '거래처A2', 'general'),
  ('c0000000-0000-0000-0000-0000000000b1', 'bbbb2222-2222-2222-2222-222222222222', '거래처B1', 'general');

insert into public.client_assignments (workspace_id, client_id, member_id) values
  ('aaaa1111-1111-1111-1111-111111111111', 'c0000000-0000-0000-0000-0000000000a1',
   'e1000000-0000-0000-0000-000000000002');

insert into public.documents (id, workspace_id, client_id, file_path, source) values
  ('d0000000-0000-0000-0000-0000000000a1', 'aaaa1111-1111-1111-1111-111111111111',
   'c0000000-0000-0000-0000-0000000000a1', 'aaaa1111-1111-1111-1111-111111111111/c/doc.pdf', 'upload');

insert into public.classification_history (workspace_id, client_id, doc_type) values
  ('aaaa1111-1111-1111-1111-111111111111', 'c0000000-0000-0000-0000-0000000000a1', 'tax_invoice');

insert into public.audit_logs (workspace_id, actor_member_id, action) values
  ('aaaa1111-1111-1111-1111-111111111111', 'e1000000-0000-0000-0000-000000000001', 'client.created');

insert into public.ai_usage (workspace_id, month, doc_count) values
  ('aaaa1111-1111-1111-1111-111111111111', date_trunc('month', now())::date, 5);

insert into public.payments (workspace_id, status, amount) values
  ('aaaa1111-1111-1111-1111-111111111111', 'paid', 9900);

set local role authenticated;

-- ---- staff(A) ----
select set_config('request.jwt.claim.sub', 'e0000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claim.email', 'staffA@a.com', true);

-- READ: workspace-wide read OK, cross-workspace blocked
select is((select count(*)::int from public.clients), 2, 'staff reads all workspace A clients');
select is(
  (select count(*)::int from public.clients where workspace_id = 'bbbb2222-2222-2222-2222-222222222222'),
  0, 'staff cannot read workspace B clients');

-- WRITE scope: can update assigned, cannot update unassigned.
-- (RLS silently affects 0 rows for out-of-scope updates; verify by reading back.)
update public.clients set memo = 'assigned-ok' where id = 'c0000000-0000-0000-0000-0000000000a1';
select is(
  (select memo from public.clients where id = 'c0000000-0000-0000-0000-0000000000a1'),
  'assigned-ok', 'staff can update an assigned client');

update public.clients set memo = 'should-not-apply' where id = 'c0000000-0000-0000-0000-0000000000a2';
select is(
  (select memo from public.clients where id = 'c0000000-0000-0000-0000-0000000000a2'),
  null, 'staff cannot update an unassigned client');

-- DELETE: owner-only → staff delete affects nothing.
delete from public.clients where id = 'c0000000-0000-0000-0000-0000000000a1';
select is(
  (select count(*)::int from public.clients where id = 'c0000000-0000-0000-0000-0000000000a1'),
  1, 'staff cannot delete a client (owner-only)');

-- Owner-only reads are hidden from staff
select is((select count(*)::int from public.audit_logs), 0, 'staff cannot read audit_logs');
select is((select count(*)::int from public.ai_usage), 0, 'staff cannot read ai_usage');
select is((select count(*)::int from public.payments), 0, 'staff cannot read payments');

-- staff cannot write owner/service-only tables
select throws_ok(
  $$insert into public.ai_usage (workspace_id, month, doc_count)
    values ('aaaa1111-1111-1111-1111-111111111111', date_trunc('month', now())::date, 1)$$,
  '42501', null, 'staff cannot insert ai_usage (service-role only)');

-- ---- owner(B): cross-tenant isolation ----
select set_config('request.jwt.claim.sub', 'e0000000-0000-0000-0000-000000000003', true);
select set_config('request.jwt.claim.email', 'ownerB@b.com', true);

select is(
  (select count(*)::int from public.documents where workspace_id = 'aaaa1111-1111-1111-1111-111111111111'),
  0, 'owner B cannot read A documents');
select is(
  (select count(*)::int from public.classification_history
   where workspace_id = 'aaaa1111-1111-1111-1111-111111111111'),
  0, 'owner B cannot read A classification_history');

-- classification_history leak (write direction): cannot insert into another workspace
select throws_ok(
  $$insert into public.classification_history (workspace_id, client_id, doc_type)
    values ('aaaa1111-1111-1111-1111-111111111111', 'c0000000-0000-0000-0000-0000000000a1', 'leak')$$,
  '42501', null, 'cannot insert classification_history into another workspace');

-- ---- owner(A): positive owner-only read ----
select set_config('request.jwt.claim.sub', 'e0000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.email', 'ownerA@a.com', true);
select is((select count(*)::int from public.audit_logs), 1, 'owner A reads own audit_logs');

reset role;

-- service role bypasses RLS for system writes
set local role service_role;
select lives_ok(
  $$insert into public.ai_usage (workspace_id, month, doc_count)
    values ('bbbb2222-2222-2222-2222-222222222222', date_trunc('month', now())::date, 2)$$,
  'service role can insert ai_usage');

reset role;
select * from finish();
rollback;
