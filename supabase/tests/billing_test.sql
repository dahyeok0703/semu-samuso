-- ============================================================================
-- Billing RLS (pgTAP).
-- Verifies:
--   - payments are owner-read-only and workspace-isolated
--   - billing_accounts (billing key) are NEVER exposed to authenticated users
--     (service role only)
--   - webhook idempotency: duplicate event_key inserts are rejected
-- ============================================================================
begin;
create extension if not exists pgtap;
select plan(8);

alter table auth.users disable trigger on_auth_user_created;

insert into auth.users (id, email) values
  ('b0000000-0000-0000-0000-000000000001', 'ownerA@a.com'),
  ('b0000000-0000-0000-0000-000000000002', 'staffA@a.com'),
  ('b0000000-0000-0000-0000-000000000003', 'ownerB@b.com');

insert into public.workspaces (id, name) values
  ('aaaaaaaa-1111-1111-1111-111111111111', '사무소 A'),
  ('bbbbbbbb-2222-2222-2222-222222222222', '사무소 B');

insert into public.members (id, workspace_id, user_id, name, role, status) values
  ('b1000000-0000-0000-0000-000000000001', 'aaaaaaaa-1111-1111-1111-111111111111',
   'b0000000-0000-0000-0000-000000000001', '대표A', 'owner', 'active'),
  ('b1000000-0000-0000-0000-000000000002', 'aaaaaaaa-1111-1111-1111-111111111111',
   'b0000000-0000-0000-0000-000000000002', '직원A', 'staff', 'active'),
  ('b1000000-0000-0000-0000-000000000003', 'bbbbbbbb-2222-2222-2222-222222222222',
   'b0000000-0000-0000-0000-000000000003', '대표B', 'owner', 'active');

insert into public.payments (workspace_id, status, amount, order_name) values
  ('aaaaaaaa-1111-1111-1111-111111111111', 'paid', 9900, 'A 구독'),
  ('bbbbbbbb-2222-2222-2222-222222222222', 'paid', 99000, 'B 구독');

insert into public.billing_accounts (workspace_id, billing_key, customer_key) values
  ('aaaaaaaa-1111-1111-1111-111111111111', 'billing_key_secret_A',
   'aaaaaaaa-1111-1111-1111-111111111111');

set local role authenticated;

-- owner A reads only their own workspace's payment
select set_config('request.jwt.claim.sub', 'b0000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.email', 'ownerA@a.com', true);
select is((select count(*)::int from public.payments), 1, 'owner A sees only A payments');

-- staff A cannot read payments (owner-only)
select set_config('request.jwt.claim.sub', 'b0000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claim.email', 'staffA@a.com', true);
select is((select count(*)::int from public.payments), 0, 'staff cannot read payments');

-- owner B cannot read workspace A payments (isolation)
select set_config('request.jwt.claim.sub', 'b0000000-0000-0000-0000-000000000003', true);
select set_config('request.jwt.claim.email', 'ownerB@b.com', true);
select is(
  (select count(*)::int from public.payments where workspace_id = 'aaaaaaaa-1111-1111-1111-111111111111'),
  0, 'owner B cannot read A payments');

-- owner A cannot read the sensitive billing_accounts: there is NO table grant
-- to authenticated at all (stronger than an RLS-filtered empty result).
select set_config('request.jwt.claim.sub', 'b0000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.email', 'ownerA@a.com', true);
select throws_ok(
  $$select count(*) from public.billing_accounts$$,
  '42501', null, 'billing key is hidden from owners (service-role only)');

-- owner A cannot insert payments directly (no insert policy)
select throws_ok(
  $$insert into public.payments (workspace_id, status, amount)
    values ('aaaaaaaa-1111-1111-1111-111111111111','paid',1000)$$,
  '42501', null, 'owner cannot insert payments (service role only)');

reset role;

-- service role bypasses RLS for system writes
set local role service_role;
select is((select count(*)::int from public.billing_accounts), 1,
  'service role can read billing_accounts');

-- webhook idempotency: first event inserts, duplicate event_key is rejected
select lives_ok(
  $$insert into public.billing_events (workspace_id, type, event_key)
    values ('aaaaaaaa-1111-1111-1111-111111111111','webhook.Transaction.Paid','evt_1')$$,
  'first webhook event inserts');
select throws_ok(
  $$insert into public.billing_events (workspace_id, type, event_key)
    values ('aaaaaaaa-1111-1111-1111-111111111111','webhook.Transaction.Paid','evt_1')$$,
  '23505', null, 'duplicate event_key is rejected (idempotency)');

reset role;
select * from finish();
rollback;
