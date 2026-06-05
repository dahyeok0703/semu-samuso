import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { env, features } from "@/lib/env";
import type { Database } from "@/types/database.types";

/**
 * Service-role Supabase client (server-only). Bypasses RLS, so use it ONLY for
 * trusted system writes that policies intentionally reserve for the service
 * role — e.g. inserting audit_logs / ai_usage / billing_events.
 *
 * Returns null when SUPABASE_SERVICE_ROLE_KEY is not configured, so callers can
 * degrade gracefully (see CLAUDE.md: "키 없으면 우아하게 비활성").
 */
export function createAdminClient() {
  if (!features.serviceRole || !env.SUPABASE_SERVICE_ROLE_KEY) return null;

  return createSupabaseClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}
