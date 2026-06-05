-- ============================================================================
-- 0010_onboarding
-- Track workspace onboarding completion so the setup wizard is shown once.
-- ============================================================================

alter table public.workspaces
  add column onboarded_at timestamptz; -- null = not yet onboarded
