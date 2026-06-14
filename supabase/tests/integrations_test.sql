-- ============================================================================
-- integration_settings RLS (pgTAP).
-- 민감 키 테이블은 internal-only: authenticated 권한 자체 없음, service_role 만.
-- ============================================================================
begin;
create extension if not exists pgtap;
select plan(2);

alter table auth.users disable trigger on_auth_user_created;

insert into auth.users (id, email) values
  ('f0000000-0000-0000-0000-000000000001', 'owner@a.com');
insert into public.workspaces (id, name) values
  ('ffff1111-1111-1111-1111-111111111111', '사무소 A');
insert into public.members (id, workspace_id, user_id, name, role, status) values
  ('f1000000-0000-0000-0000-000000000001', 'ffff1111-1111-1111-1111-111111111111',
   'f0000000-0000-0000-0000-000000000001', '대표', 'owner', 'active');
insert into public.integration_settings (workspace_id, provider, enabled, config) values
  ('ffff1111-1111-1111-1111-111111111111', 'solapi', true, '{"apiKey":"secret"}'::jsonb);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.email', 'owner@a.com', true);
select throws_ok(
  $$select count(*) from public.integration_settings$$,
  '42501', null, 'integration_settings 키는 owner 에게도 비노출(service-role only)');

reset role;
set local role service_role;
select is((select count(*)::int from public.integration_settings), 1,
  'service role can read integration_settings');

reset role;
select * from finish();
rollback;
