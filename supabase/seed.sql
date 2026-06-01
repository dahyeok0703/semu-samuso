-- ============================================================================
-- Demo seed. Runs automatically after migrations on `supabase db reset`.
--
-- Creates one demo workspace (사무소) with an owner + staff member and three
-- clients (거래처), plus a little operational data so the app isn't empty.
--
-- Demo logins (local only):
--   owner : demo-owner@semu.test / demo1234
--   staff : demo-staff@semu.test / demo1234
--
-- NOTE: targets the real Supabase local stack (auth schema with password +
-- identities). The signup trigger is disabled during seeding so we can build a
-- deterministic multi-member workspace, then re-enabled.
-- ============================================================================

-- Build the demo deterministically rather than via the signup trigger.
alter table auth.users disable trigger on_auth_user_created;

-- --- auth users (so you can actually log in) --------------------------------
insert into auth.users
  (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
   raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', 'de200000-0000-0000-0000-000000000001',
   'authenticated', 'authenticated', 'demo-owner@semu.test',
   crypt('demo1234', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}',
   '{"full_name":"김대표","office_name":"데모 세무회계"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'de200000-0000-0000-0000-000000000002',
   'authenticated', 'authenticated', 'demo-staff@semu.test',
   crypt('demo1234', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}',
   '{"full_name":"이직원","office_name":"데모 세무회계"}', now(), now())
on conflict (id) do nothing;

insert into auth.identities
  (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values
  (gen_random_uuid(), 'de200000-0000-0000-0000-000000000001', 'de200000-0000-0000-0000-000000000001',
   '{"sub":"de200000-0000-0000-0000-000000000001","email":"demo-owner@semu.test"}', 'email', now(), now(), now()),
  (gen_random_uuid(), 'de200000-0000-0000-0000-000000000002', 'de200000-0000-0000-0000-000000000002',
   '{"sub":"de200000-0000-0000-0000-000000000002","email":"demo-staff@semu.test"}', 'email', now(), now(), now())
on conflict do nothing;

-- --- workspace + members ----------------------------------------------------
insert into public.workspaces (id, name, plan, trial_ends_at) values
  ('de100000-0000-0000-0000-000000000001', '데모 세무회계', 'team', now() + interval '14 days')
on conflict (id) do nothing;

insert into public.members (id, workspace_id, user_id, name, role, status) values
  ('de300000-0000-0000-0000-000000000001', 'de100000-0000-0000-0000-000000000001',
   'de200000-0000-0000-0000-000000000001', '김대표', 'owner', 'active'),
  ('de300000-0000-0000-0000-000000000002', 'de100000-0000-0000-0000-000000000001',
   'de200000-0000-0000-0000-000000000002', '이직원', 'staff', 'active')
on conflict (id) do nothing;

-- --- clients (거래처) × 3 ----------------------------------------------------
insert into public.clients
  (id, workspace_id, biz_name, biz_reg_no, ceo_name, industry, tax_type,
   closing_month, is_semiannual_withholding, is_diligent_filing,
   contact_phone, contact_email, status, memo)
values
  ('de400000-0000-0000-0000-000000000001', 'de100000-0000-0000-0000-000000000001',
   '가나다상사', '123-45-67890', '박가나', '도소매', 'general',
   12, false, false, '02-1234-5678', 'gananda@example.com', 'active', '월 기장 거래처'),
  ('de400000-0000-0000-0000-000000000002', 'de100000-0000-0000-0000-000000000001',
   '라마바김밥', '234-56-78901', '최라마', '음식점', 'simplified',
   12, false, false, '010-2345-6789', 'ramaba@example.com', 'active', '간이과세'),
  ('de400000-0000-0000-0000-000000000003', 'de100000-0000-0000-0000-000000000001',
   '사아자테크', '345-67-89012', '정사아', '소프트웨어 개발', 'corporate',
   3, true, true, '031-345-6789', 'saaja@example.com', 'active', '법인 / 3월 결산 / 성실신고')
on conflict (id) do nothing;

-- --- assignments: staff handles the first two clients ------------------------
insert into public.client_assignments (workspace_id, client_id, member_id) values
  ('de100000-0000-0000-0000-000000000001', 'de400000-0000-0000-0000-000000000001', 'de300000-0000-0000-0000-000000000002'),
  ('de100000-0000-0000-0000-000000000001', 'de400000-0000-0000-0000-000000000002', 'de300000-0000-0000-0000-000000000002')
on conflict (client_id, member_id) do nothing;

-- --- a couple of filing tasks + a checklist ---------------------------------
insert into public.filing_tasks
  (id, workspace_id, client_id, filing_type, period_label, due_date, status, docs_status, assigned_member_id)
values
  ('de500000-0000-0000-0000-000000000001', 'de100000-0000-0000-0000-000000000001',
   'de400000-0000-0000-0000-000000000001', 'vat_1', '2025년 1기 예정', date '2025-04-25',
   'pending', 'partial', 'de300000-0000-0000-0000-000000000002'),
  ('de500000-0000-0000-0000-000000000002', 'de100000-0000-0000-0000-000000000001',
   'de400000-0000-0000-0000-000000000003', 'corporate', '2024 사업연도', date '2025-03-31',
   'docs_received', 'complete', 'de300000-0000-0000-0000-000000000001')
on conflict (id) do nothing;

insert into public.expected_documents (workspace_id, filing_task_id, doc_type, is_received) values
  ('de100000-0000-0000-0000-000000000001', 'de500000-0000-0000-0000-000000000001', '매출 세금계산서', true),
  ('de100000-0000-0000-0000-000000000001', 'de500000-0000-0000-0000-000000000001', '매입 세금계산서', false),
  ('de100000-0000-0000-0000-000000000001', 'de500000-0000-0000-0000-000000000001', '카드매출 내역', false)
on conflict (filing_task_id, doc_type) do nothing;

-- --- a confirmed classification (learning-loop sample) ----------------------
insert into public.classification_history
  (workspace_id, client_id, doc_type, account_hint, features, was_corrected, confirmed_at)
values
  ('de100000-0000-0000-0000-000000000001', 'de400000-0000-0000-0000-000000000001',
   '세금계산서', '복리후생비', '{"vendor":"행복마트","amount_band":"1만~5만","keywords":["간식","음료"]}', false, now())
on conflict do nothing;

-- --- current-month AI usage (margin tracking) -------------------------------
insert into public.ai_usage (workspace_id, month, input_tokens, output_tokens, doc_count, est_cost_krw) values
  ('de100000-0000-0000-0000-000000000001', date_trunc('month', current_date)::date, 152000, 38000, 42, 1830.00)
on conflict (workspace_id, month) do nothing;

-- --- a welcome notification for the owner -----------------------------------
insert into public.notifications (workspace_id, member_id, type, title, body, link) values
  ('de100000-0000-0000-0000-000000000001', 'de300000-0000-0000-0000-000000000001',
   'system', '환영합니다 👋', '데모 데이터가 준비되었습니다. 거래처 메뉴를 확인해 보세요.', '/clients')
on conflict do nothing;

insert into public.audit_logs (workspace_id, actor_member_id, action, target_table, meta) values
  ('de100000-0000-0000-0000-000000000001', 'de300000-0000-0000-0000-000000000001',
   'seed.loaded', 'workspaces', '{"source":"seed.sql"}')
on conflict do nothing;

alter table auth.users enable trigger on_auth_user_created;
