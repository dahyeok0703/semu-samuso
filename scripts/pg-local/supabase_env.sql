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

-- auth.email() — mirrors Supabase's helper (used by invitation RLS policies).
create or replace function auth.email()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email'
  );
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
grant execute on function auth.email() to anon, authenticated, service_role;
grant select on auth.users to authenticated, service_role;

-- storage shim (Supabase provides schema "storage"; recreate the minimum the
-- migrations/policies touch so they can be applied & RLS-tested locally).
create schema if not exists storage;

create table if not exists storage.buckets (
  id          text primary key,
  name        text not null,
  public      boolean not null default false,
  created_at  timestamptz not null default now()
);

create table if not exists storage.objects (
  id          uuid primary key default gen_random_uuid(),
  bucket_id   text references storage.buckets (id),
  name        text not null,
  owner       uuid,
  metadata    jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table storage.objects enable row level security;

-- Supabase's storage.foldername returns the path's folder segments.
create or replace function storage.foldername(name text)
returns text[]
language sql
immutable
as $$ select string_to_array(name, '/'); $$;

grant usage on schema storage to anon, authenticated, service_role;
grant select, insert, update, delete on storage.objects to authenticated, service_role;
grant select on storage.buckets to authenticated, service_role;
