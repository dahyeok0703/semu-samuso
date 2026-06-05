import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database.types";

export type AuditEntry = {
  workspaceId: string;
  actorMemberId: string | null;
  action: string;
  targetTable?: string | null;
  targetId?: string | null;
  meta?: Json;
};

/**
 * Best-effort audit trail. audit_logs inserts are reserved for the service role
 * (see migrations), so this uses the admin client. If the service-role key is
 * not configured, or the insert fails, we log a warning rather than failing the
 * user's write — auditing must never block the primary operation.
 */
export async function logAudit(entry: AuditEntry): Promise<void> {
  const admin = createAdminClient();
  if (!admin) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[audit] skipped "${entry.action}" — SUPABASE_SERVICE_ROLE_KEY not set`);
    }
    return;
  }

  const { error } = await admin.from("audit_logs").insert({
    workspace_id: entry.workspaceId,
    actor_member_id: entry.actorMemberId,
    action: entry.action,
    target_table: entry.targetTable ?? null,
    target_id: entry.targetId ?? null,
    meta: entry.meta ?? {},
  });

  if (error) {
    console.error(`[audit] failed to record "${entry.action}":`, error.message);
  }
}
