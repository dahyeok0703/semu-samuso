-- ============================================================================
-- Supabase environment shim for LOCAL, Docker-less testing.
--
-- Real Supabase (and `supabase db reset` / `supabase test db`) already provides
-- the `auth` schema, `auth.users`, `auth.uid()` and the anon/authenticated/
-- service_role roles. This file recreates *just enough* of that so the
-- migrations and pgTAP tests can run against a plain PostgreSQL instance.
--
-- Do NOT run this against a real Supabase database — it is only for the
-- scripts/test-rls-local.sh harness.
-- ============================================================================

-- Roles ----------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    -- Supabase's service_role bypasses RLS for trusted back-office/system work.
    create role service_role nologin noinherit bypassrls;
  end if;
end
$$;

-- auth schema + minimal users table ------------------------------------------
create schema if not exists auth;

create table if not exists auth.users (
  id                  uuid primary key default gen_random_uuid(),
  email               text,
  raw_user_meta_data  jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now()
);

-- auth.uid() — reads the request JWT subject the same way Supabase does, so the
-- tests can impersonate users via: set local request.jwt.claim.sub = '<uuid>'.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
  )::uuid;
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
grant select on auth.users to authenticated, service_role;
