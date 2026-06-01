-- ============================================================================
-- RLS isolation tests (pgTAP).
--
-- Proves the workspace-isolation guarantees from CLAUDE.md:
--   1. A member cannot see another workspace's data.
--   2. A staff member cannot modify clients they are not assigned to
--      (and never another workspace's clients).
--   3. classification_history (the learning loop) is never readable across
--      workspaces.
-- Plus: owner-only writes, owner-only cost/audit reads, WITH CHECK enforcement,
--       and service_role bypass.
--
-- Run with `supabase test db` (Docker) or scripts/test-rls-local.sh (plain PG).
--
-- Impersonation: we run as the `authenticated` role and set the request JWT
-- subject (auth.uid()) per user — exactly how Supabase evaluates RLS.
-- ============================================================================

begin;
create extension if not exists pgtap;
select plan(30);

-- ----------------------------------------------------------------------------
-- Fixtures (created as the superuser/owner; bypasses RLS). The signup trigger
-- is disabled so we can wire up a deterministic two-workspace topology.
-- ----------------------------------------------------------------------------
alter table auth.users disable trigger on_auth_user_created;

insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000001', 'owner-a@example.com'),
  ('a0000000-0000-0000-0000-000000000002', 'staff-a1@example.com'),
  ('a0000000-0000-0000-0000-000000000003', 'staff-a2@example.com'),
  ('b0000000-0000-0000-0000-000000000001', 'owner-b@example.com');

insert into public.workspaces (id, name) values
  ('11111111-1111-1111-1111-111111111111', '워크스페이스 A'),
  ('22222222-2222-2222-2222-222222222222', '워크스페이스 B');

insert into public.members (id, workspace_id, user_id, name, role, status) values
  ('a1000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000001', '대표A', 'owner', 'active'),
  ('a1000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000002', '직원A1', 'staff', 'active'),
  ('a1000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000003', '직원A2', 'staff', 'active'),
  ('b1000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'b0000000-0000-0000-0000-000000000001', '대표B', 'owner', 'active');

insert into public.clients (id, workspace_id, biz_name, memo, status) values
  ('ac000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '거래처A1', 'orig', 'active'),
  ('ac000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', '거래처A2', 'orig', 'active'),
  ('bc000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', '거래처B1', 'orig', 'active');

-- staff_a1 is assigned to client_a1 only; staff_a2 to client_a2 only.
insert into public.client_assignments (workspace_id, client_id, member_id) values
  ('11111111-1111-1111-1111-111111111111', 'ac000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000002'),
  ('11111111-1111-1111-1111-111111111111', 'ac000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000003');

insert into public.filing_tasks (id, workspace_id, client_id, filing_type, period_label, status, assigned_member_id) values
  ('af000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'ac000000-0000-0000-0000-000000000001', 'vat_1', '2025-1기', 'pending', 'a1000000-0000-0000-0000-000000000002');

insert into public.classification_history (id, workspace_id, client_id, doc_type, features) values
  ('cf000000-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111', 'ac000000-0000-0000-0000-000000000001', '세금계산서', '{"vendor":"A상사"}'),
  ('cf000000-0000-0000-0000-00000000000b', '22222222-2222-2222-2222-222222222222', 'bc000000-0000-0000-0000-000000000001', '카드매출전표', '{"vendor":"B마트"}');

insert into public.ai_usage (workspace_id, month, doc_count, est_cost_krw) values
  ('11111111-1111-1111-1111-111111111111', '2025-01-01', 10, 1234.50),
  ('22222222-2222-2222-2222-222222222222', '2025-01-01', 20, 4321.00);

insert into public.audit_logs (workspace_id, actor_member_id, action) values
  ('11111111-1111-1111-1111-111111111111', 'a1000000-0000-0000-0000-000000000001', 'workspace.created'),
  ('22222222-2222-2222-2222-222222222222', 'b1000000-0000-0000-0000-000000000001', 'workspace.created');

-- Helper aliases for readability.
\set owner_a '\'a0000000-0000-0000-0000-000000000001\''
\set staff_a1 '\'a0000000-0000-0000-0000-000000000002\''
\set staff_a2 '\'a0000000-0000-0000-0000-000000000003\''
\set owner_b '\'b0000000-0000-0000-0000-000000000001\''

-- ----------------------------------------------------------------------------
-- Switch to the authenticated role; impersonate per assertion via JWT sub.
-- ----------------------------------------------------------------------------
set local role authenticated;

-- === 1. Cross-workspace SELECT isolation: clients ===========================
select set_config('request.jwt.claim.sub', :owner_a, true);
select is((select count(*)::int from public.clients), 2,
  'owner_a sees exactly the 2 clients of workspace A');
select is((select count(*)::int from public.clients where workspace_id = '22222222-2222-2222-2222-222222222222'), 0,
  'owner_a cannot see workspace B clients');

select set_config('request.jwt.claim.sub', :owner_b, true);
select is((select count(*)::int from public.clients), 1,
  'owner_b sees exactly the 1 client of workspace B');
select is((select count(*)::int from public.clients where workspace_id = '11111111-1111-1111-1111-111111111111'), 0,
  'owner_b cannot see workspace A clients');

select set_config('request.jwt.claim.sub', :staff_a1, true);
select is((select count(*)::int from public.clients), 2,
  'staff reads ALL clients in their own workspace (read is workspace-wide)');

-- === 2. Cross-workspace SELECT isolation: members ===========================
select set_config('request.jwt.claim.sub', :staff_a1, true);
select is((select count(*)::int from public.members), 3,
  'staff_a1 sees the 3 members of workspace A');
select is((select count(*)::int from public.members where workspace_id = '22222222-2222-2222-2222-222222222222'), 0,
  'staff_a1 cannot see workspace B members');

-- === 3. ★ classification_history is never visible across workspaces =========
select set_config('request.jwt.claim.sub', :owner_a, true);
select is((select count(*)::int from public.classification_history), 1,
  'owner_a sees only workspace A classification_history');
select is((select count(*)::int from public.classification_history
           where id = 'cf000000-0000-0000-0000-00000000000b'), 0,
  'owner_a cannot see workspace B classification_history row');

select set_config('request.jwt.claim.sub', :owner_b, true);
select is((select count(*)::int from public.classification_history), 1,
  'owner_b sees only workspace B classification_history');
select is((select count(*)::int from public.classification_history
           where id = 'cf000000-0000-0000-0000-00000000000a'), 0,
  '★ workspace A classification_history is NOT readable from workspace B');

select set_config('request.jwt.claim.sub', :staff_a1, true);
select is((select count(*)::int from public.classification_history), 1,
  'staff_a1 reads workspace A classification_history (workspace-wide read)');

-- === 4. Staff write scoping: clients ========================================
-- 4a. staff_a1 CAN edit the client they are assigned to.
select set_config('request.jwt.claim.sub', :staff_a1, true);
update public.clients set memo = 'touched-by-staff' where id = 'ac000000-0000-0000-0000-000000000001';
reset role;
select is((select memo from public.clients where id = 'ac000000-0000-0000-0000-000000000001'),
  'touched-by-staff', 'staff_a1 CAN update a client they are assigned to');

-- 4b. staff_a1 CANNOT edit an unassigned client in the same workspace.
set local role authenticated;
select set_config('request.jwt.claim.sub', :staff_a1, true);
update public.clients set memo = 'hacked' where id = 'ac000000-0000-0000-0000-000000000002';
reset role;
select is((select memo from public.clients where id = 'ac000000-0000-0000-0000-000000000002'),
  'orig', 'staff_a1 CANNOT update an unassigned client (same workspace)');

-- 4c. staff_a1 CANNOT edit a client in another workspace.
set local role authenticated;
select set_config('request.jwt.claim.sub', :staff_a1, true);
update public.clients set memo = 'hacked' where id = 'bc000000-0000-0000-0000-000000000001';
reset role;
select is((select memo from public.clients where id = 'bc000000-0000-0000-0000-000000000001'),
  'orig', 'staff_a1 CANNOT update a client in another workspace');

-- === 5. INSERT WITH CHECK / owner-only enforcement ==========================
set local role authenticated;
select set_config('request.jwt.claim.sub', :staff_a1, true);
select throws_ok(
  $$insert into public.clients (workspace_id, biz_name) values ('11111111-1111-1111-1111-111111111111', '신규')$$,
  '42501', null, 'staff cannot create a client (owner-only insert)');

select set_config('request.jwt.claim.sub', :owner_a, true);
select throws_ok(
  $$insert into public.clients (workspace_id, biz_name) values ('22222222-2222-2222-2222-222222222222', '교차')$$,
  '42501', null, 'owner_a cannot insert a client into another workspace (WITH CHECK)');

select lives_ok(
  $$insert into public.clients (workspace_id, biz_name) values ('11111111-1111-1111-1111-111111111111', '신규거래처')$$,
  'owner_a CAN create a client in their own workspace');

-- === 6. Staff write scoping: documents ======================================
select set_config('request.jwt.claim.sub', :staff_a1, true);
select lives_ok(
  $$insert into public.documents (workspace_id, client_id, file_path)
    values ('11111111-1111-1111-1111-111111111111', 'ac000000-0000-0000-0000-000000000001', '/a1.pdf')$$,
  'staff_a1 CAN add a document to an assigned client');
select throws_ok(
  $$insert into public.documents (workspace_id, client_id, file_path)
    values ('11111111-1111-1111-1111-111111111111', 'ac000000-0000-0000-0000-000000000002', '/a2.pdf')$$,
  '42501', null, 'staff_a1 CANNOT add a document to an unassigned client');

-- === 7. Filing task scoping =================================================
-- staff_a1 owns task_a1 (assigned_member_id) -> may update it.
select set_config('request.jwt.claim.sub', :staff_a1, true);
update public.filing_tasks set status = 'filed' where id = 'af000000-0000-0000-0000-000000000001';
reset role;
select is((select status::text from public.filing_tasks where id = 'af000000-0000-0000-0000-000000000001'),
  'filed', 'staff_a1 CAN update a task assigned to them');

-- staff_a2 is neither the assignee nor assigned to the client -> cannot update.
set local role authenticated;
select set_config('request.jwt.claim.sub', :staff_a2, true);
update public.filing_tasks set status = 'done' where id = 'af000000-0000-0000-0000-000000000001';
reset role;
select is((select status::text from public.filing_tasks where id = 'af000000-0000-0000-0000-000000000001'),
  'filed', 'staff_a2 CANNOT update a task not assigned to them or their client');

-- === 8. ai_usage: owner-only read, no member write ==========================
set local role authenticated;
select set_config('request.jwt.claim.sub', :owner_a, true);
select is((select count(*)::int from public.ai_usage), 1,
  'owner_a CAN read ai_usage for their workspace');

select set_config('request.jwt.claim.sub', :staff_a1, true);
select is((select count(*)::int from public.ai_usage), 0,
  'staff CANNOT read ai_usage (owner-only)');

select set_config('request.jwt.claim.sub', :owner_a, true);
select throws_ok(
  $$insert into public.ai_usage (workspace_id, month) values ('11111111-1111-1111-1111-111111111111', '2025-09-01')$$,
  '42501', null, 'authenticated (even owner) cannot write ai_usage (no grant)');

-- service_role bypasses RLS and may write usage/cost rows.
reset role;
set local role service_role;
select lives_ok(
  $$insert into public.ai_usage (workspace_id, month, doc_count, est_cost_krw)
    values ('11111111-1111-1111-1111-111111111111', '2025-10-01', 7, 999.99)$$,
  'service_role CAN write ai_usage (bypasses RLS)');

-- === 9. audit_logs & billing_events: owner-only read ========================
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', :owner_a, true);
select is((select count(*)::int from public.audit_logs), 1,
  'owner_a CAN read audit_logs for their workspace');

select set_config('request.jwt.claim.sub', :staff_a1, true);
select is((select count(*)::int from public.audit_logs), 0,
  'staff CANNOT read audit_logs (owner-only)');

-- === 10. Unauthenticated (no JWT) sees nothing ==============================
select set_config('request.jwt.claim.sub', '', true);
select is((select count(*)::int from public.clients), 0,
  'a request with no auth.uid() sees no rows');
select is((select count(*)::int from public.classification_history), 0,
  'a request with no auth.uid() sees no classification_history');

reset role;
select * from finish();
rollback;
