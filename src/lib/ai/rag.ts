import "server-only";

import type { DocType } from "@/lib/ai/doc-types";
import type { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database.types";

export type RagExample = {
  doc_type: DocType;
  vendor: string | null;
  amount_band: string | null;
  keywords: string[];
  account_hint: string | null;
};

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

const MAX_EXAMPLES = 8;

function asExample(row: {
  doc_type: string;
  account_hint: string | null;
  features: Json;
}): RagExample {
  const f = (row.features ?? {}) as Record<string, unknown>;
  const keywords = Array.isArray(f.keywords)
    ? (f.keywords as unknown[]).filter((k): k is string => typeof k === "string")
    : [];
  return {
    doc_type: row.doc_type as DocType,
    vendor: typeof f.vendor === "string" ? f.vendor : null,
    amount_band: typeof f.amount_band === "string" ? f.amount_band : null,
    keywords,
    account_hint: row.account_hint,
  };
}

/**
 * ★RAG 컨텍스트 조회. 같은 client_id 의 확정 이력을 우선 사용하고, 부족하면
 * 같은 워크스페이스의 최근 확정 이력으로 보충한다(유사 발행처/금액대 후보).
 *
 * ★격리: 항상 호출자의 RLS 세션 클라이언트로 조회하므로 classification_history
 * select 정책(workspace_id = current_workspace_id())에 의해 **타 워크스페이스
 * 이력은 절대 조회되지 않는다.** (프롬프트 격리는 prompt.ts 의 지침으로 이중화.)
 */
export async function getRagContext(
  supabase: SupabaseServer,
  clientId: string,
): Promise<RagExample[]> {
  const { data: own } = await supabase
    .from("classification_history")
    .select("doc_type, account_hint, features")
    .eq("client_id", clientId)
    .order("confirmed_at", { ascending: false })
    .limit(MAX_EXAMPLES);

  const examples = (own ?? []).map(asExample);
  if (examples.length >= 3) return examples;

  // Supplement with recent workspace-wide history (still RLS-scoped).
  const { data: workspaceWide } = await supabase
    .from("classification_history")
    .select("doc_type, account_hint, features")
    .neq("client_id", clientId)
    .order("confirmed_at", { ascending: false })
    .limit(MAX_EXAMPLES - examples.length);

  return [...examples, ...(workspaceWide ?? []).map(asExample)];
}
