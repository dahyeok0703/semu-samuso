#!/usr/bin/env bash
# ============================================================================
# Docker-less RLS test runner.
#
# Spins up the schema on a throwaway local PostgreSQL database (emulating the
# Supabase auth environment via scripts/pg-local/supabase_env.sql), then runs
# the pgTAP isolation suite with pg_prove.
#
# Requirements: a running local PostgreSQL with pgTAP + pg_prove installed and
# a superuser role matching $PGUSER (default: current user). For the canonical
# Docker-based flow use `supabase test db` instead (see README).
#
# Usage:  scripts/test-rls-local.sh
# Env:    PGDATABASE (default semu_test_rls), PGHOST/PGUSER as usual.
# ============================================================================
set -euo pipefail

cd "$(dirname "$0")/.."

DB="${PGDATABASE:-semu_test_rls}"
export PGDATABASE="$DB"

echo "▶ (re)creating database '$DB'"
psql -d postgres -v ON_ERROR_STOP=1 -qc "drop database if exists \"$DB\";" >/dev/null
psql -d postgres -v ON_ERROR_STOP=1 -qc "create database \"$DB\";" >/dev/null

echo "▶ applying Supabase environment shim"
psql -v ON_ERROR_STOP=1 -q -f scripts/pg-local/supabase_env.sql

echo "▶ applying migrations"
for f in supabase/migrations/*.sql; do
  echo "    - $f"
  psql -v ON_ERROR_STOP=1 -q -f "$f"
done

echo "▶ running pgTAP isolation suite"
pg_prove --ext .sql supabase/tests/*.sql

echo "✔ done"
