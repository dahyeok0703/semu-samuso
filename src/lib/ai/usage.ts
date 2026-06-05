import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { createClient } from "@/lib/supabase/server";

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

function firstOfMonthISO(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

function startOfTodayISO(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString();
}

export type UsageDelta = {
  inputTokens: number;
  outputTokens: number;
  costKrw: number;
};

/**
 * ★마진 보호: 워크스페이스·월별 AI 사용량/원가를 ai_usage 에 누적한다.
 * ai_usage 쓰기는 service_role 전용(RLS)이므로 admin 클라이언트를 쓴다.
 * 키 미설정 시 best-effort 로 건너뛴다(사용자 작업을 막지 않음).
 */
export async function recordAiUsage(workspaceId: string, delta: UsageDelta): Promise<void> {
  const admin = createAdminClient();
  if (!admin) return;
  const month = firstOfMonthISO();

  const { data: existing } = await admin
    .from("ai_usage")
    .select("input_tokens, output_tokens, doc_count, est_cost_krw")
    .eq("workspace_id", workspaceId)
    .eq("month", month)
    .maybeSingle();

  const { error } = await admin.from("ai_usage").upsert(
    {
      workspace_id: workspaceId,
      month,
      input_tokens: (existing?.input_tokens ?? 0) + delta.inputTokens,
      output_tokens: (existing?.output_tokens ?? 0) + delta.outputTokens,
      doc_count: (existing?.doc_count ?? 0) + 1,
      est_cost_krw: Number(existing?.est_cost_krw ?? 0) + delta.costKrw,
    },
    { onConflict: "workspace_id,month" },
  );
  if (error) console.error("[ai_usage] failed to record:", error.message);
}

/** Count today's AI classifications for the workspace (daily-limit guard). */
export async function getDailyClassifyCount(
  supabase: SupabaseServer,
  workspaceId: string,
): Promise<number> {
  const { count } = await supabase
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("classified_by_ai", true)
    .gte("updated_at", startOfTodayISO());
  return count ?? 0;
}
