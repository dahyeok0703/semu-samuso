-- ============================================================================
-- 0011_billing
-- Subscription billing: plan/seat/trial state on the workspace, the sensitive
-- billing account (provider billing key — service-role only), and the charge
-- history (영수증/청구 이력 — owner read-only). Provider-agnostic columns so the
-- PortOne adapter can be swapped for a direct Toss integration without schema
-- changes (see src/lib/billing/provider.ts).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Subscription lifecycle status.
--   none       — never subscribed (free, or trial not started)
--   trialing   — inside the 14-day free trial
--   active     — paid subscription in good standing
--   past_due   — a charge failed; inside the grace period before downgrade
--   canceled   — canceled; access until current_period_end, then → free
-- ----------------------------------------------------------------------------
create type public.subscription_status as enum (
  'none',
  'trialing',
  'active',
  'past_due',
  'canceled'
);

-- ----------------------------------------------------------------------------
-- workspaces: displayable subscription state. SAFE for the owner to read
-- (no secrets here — the billing key lives in billing_accounts).
-- ----------------------------------------------------------------------------
alter table public.workspaces
  add column subscription_status public.subscription_status not null default 'none',
  add column billing_seats        integer not null default 1 check (billing_seats >= 1),
  add column current_period_end   timestamptz,
  add column grace_until          timestamptz,
  add column cancel_at_period_end boolean not null default false,
  add column card_brand           text,
  add column card_last4           text;

-- ----------------------------------------------------------------------------
-- billing_accounts — the SENSITIVE provider credential (billing key, customer
-- key, scheduled-payment id). NEVER exposed to clients: RLS is enabled with no
-- policy for `authenticated`, so only the service role (which bypasses RLS)
-- can read/write it. Display metadata (card last4, status) stays on workspaces.
-- ----------------------------------------------------------------------------
create table public.billing_accounts (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null unique references public.workspaces (id) on delete cascade,
  provider        text not null default 'portone',
  billing_key     text,
  customer_key    text,
  subscription_id text, -- provider id of the next scheduled charge
  plan            public.workspace_plan,
  seats           integer not null default 1,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger billing_accounts_set_updated_at
  before update on public.billing_accounts
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- payments — charge history (청구 이력 / 영수증). Owner read-only; the service
-- role writes rows when a charge succeeds/fails via the webhook.
-- provider_payment_id is globally unique → it doubles as the idempotency key
-- for upserts from re-delivered webhooks.
-- ----------------------------------------------------------------------------
create table public.payments (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references public.workspaces (id) on delete cascade,
  provider            text not null default 'portone',
  provider_payment_id text,
  status              text not null default 'pending', -- paid | failed | canceled | pending
  plan                public.workspace_plan,
  seats               integer,
  amount              integer not null default 0,      -- KRW, integer (no minor unit)
  currency            text not null default 'KRW',
  order_name          text,
  receipt_url         text,
  failure_reason      text,
  paid_at             timestamptz,
  raw                 jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index payments_workspace_id_idx on public.payments (workspace_id, created_at desc);
create unique index payments_provider_payment_id_key
  on public.payments (provider_payment_id)
  where provider_payment_id is not null;

create trigger payments_set_updated_at
  before update on public.payments
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- billing_events idempotency: event_key holds the provider's unique delivery id
-- (Standard Webhooks `webhook-id`). A unique index lets the webhook handler
-- dedupe re-deliveries by attempting the insert and treating 23505 as "already
-- processed" (see src/lib/billing/service.ts).
-- ----------------------------------------------------------------------------
alter table public.billing_events
  add column event_key text;

create unique index billing_events_event_key_key
  on public.billing_events (event_key)
  where event_key is not null;

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table public.billing_accounts enable row level security;
alter table public.payments enable row level security;

-- billing_accounts: intentionally NO policy for authenticated → not readable by
-- any logged-in user. Service role bypasses RLS for system writes.

-- payments: owner read-only; inserts/updates via service role only.
create policy "payments_select_owner" on public.payments
  for select
  using (workspace_id = public.current_workspace_id() and public.is_owner());

-- ----------------------------------------------------------------------------
-- Grants
-- ----------------------------------------------------------------------------
grant select on public.payments to authenticated;
grant select, insert, update, delete on public.payments to service_role;

-- billing_accounts is service-role only (no authenticated grant).
grant select, insert, update, delete on public.billing_accounts to service_role;
