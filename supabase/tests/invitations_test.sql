-- ============================================================================
-- Invitation acceptance RLS (pgTAP).
-- Verifies the no-service-role accept path is safe:
--   - an invited user can read & accept their own invite (insert a staff member)
--   - cannot escalate to owner, cannot accept without a matching invite,
--   - cannot read another person's invite.
-- ============================================================================
begin;
create extension if not exists pgtap;
select plan(8);

alter table auth.users disable trigger on_auth_user_created;

insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000001', 'owner@a.com'),
  ('a0000000-0000-0000-0000-000000000002', 'newstaff@a.com'),
  ('a0000000-0000-0000-0000-000000000003', 'escal@a.com'),
  ('a0000000-0000-0000-0000-000000000004', 'stranger@x.com');

insert into public.workspaces (id, name) values
  ('11111111-1111-1111-1111-111111111111', '워크스페이스 A');

insert into public.members (id, workspace_id, user_id, name, role, status) values
  ('a1000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   'a0000000-0000-0000-0000-000000000001', '대표A', 'owner', 'active');

insert into public.invitations (workspace_id, email, role, token, status) values
  ('11111111-1111-1111-1111-111111111111', 'newstaff@a.com', 'staff', 'tok_newstaff', 'pending'),
  ('11111111-1111-1111-1111-111111111111', 'escal@a.com', 'staff', 'tok_escal', 'pending');

set local role authenticated;

-- owner sees workspace invitations
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.email', 'owner@a.com', true);
select is((select count(*)::int from public.invitations), 2, 'owner reads all workspace invitations');

-- invited user reads only their own invite
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claim.email', 'newstaff@a.com', true);
select is(
  (select count(*)::int from public.invitations where token = 'tok_newstaff'),
  1, 'invited user can read their own invite by token');

-- stranger cannot read the invite
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000004', true);
select set_config('request.jwt.claim.email', 'stranger@x.com', true);
select is(
  (select count(*)::int from public.invitations where token = 'tok_newstaff'),
  0, 'stranger cannot read someone else''s invite');

-- stranger cannot self-insert a member (no matching invite)
select throws_ok(
  $$insert into public.members (workspace_id, user_id, name, role, status)
    values ('11111111-1111-1111-1111-111111111111','a0000000-0000-0000-0000-000000000004','침입','staff','active')$$,
  '42501', null, 'stranger cannot join without an invitation');

-- invited user accepts → may insert a staff member for themselves
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claim.email', 'newstaff@a.com', true);
select lives_ok(
  $$insert into public.members (workspace_id, user_id, name, role, status)
    values ('11111111-1111-1111-1111-111111111111','a0000000-0000-0000-0000-000000000002','신입','staff','active')$$,
  'invited user can accept (insert own staff member)');
select is(
  (select role::text from public.members where user_id = 'a0000000-0000-0000-0000-000000000002'),
  'staff', 'accepted member is staff');

-- escalation blocked: invited user cannot insert themselves as owner
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000003', true);
select set_config('request.jwt.claim.email', 'escal@a.com', true);
select throws_ok(
  $$insert into public.members (workspace_id, user_id, name, role, status)
    values ('11111111-1111-1111-1111-111111111111','a0000000-0000-0000-0000-000000000003','권한상승','owner','active')$$,
  '42501', null, 'invited user cannot self-insert as owner (no escalation)');
select lives_ok(
  $$insert into public.members (workspace_id, user_id, name, role, status)
    values ('11111111-1111-1111-1111-111111111111','a0000000-0000-0000-0000-000000000003','정상','staff','active')$$,
  'invited user can still insert as staff');

reset role;
select * from finish();
rollback;
