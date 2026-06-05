-- ============================================================================
-- 0006_filing_task_dedup
-- Make filing-schedule generation idempotent: a given (client, filing_type,
-- period_label) may exist at most once. The auto-generation engine relies on
-- this both to skip duplicates and as an integrity backstop for concurrent
-- batch runs.
-- ============================================================================

create unique index filing_tasks_client_type_period_key
  on public.filing_tasks (client_id, filing_type, period_label);
