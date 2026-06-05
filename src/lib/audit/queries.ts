import { z } from "zod";

import { AUDIT_ACTION_LABELS } from "@/lib/audit/labels";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database.types";

export const AUDIT_PAGE_SIZE = 30;

export const auditParamsSchema = z.object({
  member: z.string().uuid().optional().catch(undefined),
  action: z
    .string()
    .refine((v) => v in AUDIT_ACTION_LABELS, { message: "unknown action" })
    .optional()
    .catch(undefined),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .catch(undefined),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .catch(undefined),
  page: z.coerce.number().int().min(1).catch(1),
});

export type AuditParams = z.infer<typeof auditParamsSchema>;

export type AuditEntry = {
  id: string;
  actorName: string;
  action: string;
  targetTable: string | null;
  targetId: string | null;
  meta: Json;
  createdAt: string;
};

export type AuditPage = {
  entries: AuditEntry[];
  total: number;
  page: number;
  pageCount: number;
};

/** Owner-only audit log listing with filters + pagination (RLS enforces owner). */
export async function listAuditLogs(params: AuditParams): Promise<AuditPage> {
  const supabase = await createClient();
  const from = (params.page - 1) * AUDIT_PAGE_SIZE;
  const to = from + AUDIT_PAGE_SIZE - 1;

  let query = supabase
    .from("audit_logs")
    .select("id, actor_member_id, action, target_table, target_id, meta, created_at", {
      count: "exact",
    });

  if (params.member) query = query.eq("actor_member_id", params.member);
  if (params.action) query = query.eq("action", params.action);
  if (params.from) query = query.gte("created_at", `${params.from}T00:00:00Z`);
  if (params.to) query = query.lte("created_at", `${params.to}T23:59:59Z`);

  const { data, count } = await query.order("created_at", { ascending: false }).range(from, to);
  const rows = data ?? [];

  const memberIds = [...new Set(rows.map((r) => r.actor_member_id).filter(Boolean))] as string[];
  const nameMap = new Map<string, string>();
  if (memberIds.length > 0) {
    const { data: members } = await supabase.from("members").select("id, name").in("id", memberIds);
    for (const m of members ?? []) nameMap.set(m.id, m.name);
  }

  return {
    entries: rows.map((r) => ({
      id: r.id,
      actorName: r.actor_member_id ? (nameMap.get(r.actor_member_id) ?? "(삭제된 직원)") : "시스템",
      action: r.action,
      targetTable: r.target_table,
      targetId: r.target_id,
      meta: r.meta,
      createdAt: r.created_at,
    })),
    total: count ?? 0,
    page: params.page,
    pageCount: Math.max(1, Math.ceil((count ?? 0) / AUDIT_PAGE_SIZE)),
  };
}
