import { createClient } from "@/lib/supabase/server";

export type AccuracyBucket = {
  key: string;
  label: string;
  total: number;
  corrected: number;
  accuracy: number | null; // (total - corrected) / total
};

export type ClassificationInsights = {
  overall: { total: number; corrected: number; accuracy: number | null };
  byMonth: AccuracyBucket[];
  byClient: (AccuracyBucket & { clientId: string })[];
};

function accuracy(total: number, corrected: number): number | null {
  return total === 0 ? null : Math.round(((total - corrected) / total) * 1000) / 1000;
}

/**
 * Classification accuracy = agreement rate between the AI's suggestion and the
 * human-confirmed result (1 − corrected/total) from classification_history.
 * RLS keeps this strictly within the caller's workspace.
 */
export async function getClassificationInsights(): Promise<ClassificationInsights> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("classification_history")
    .select("client_id, was_corrected, confirmed_at")
    .order("confirmed_at", { ascending: false })
    .limit(5000);

  const rows = data ?? [];
  const total = rows.length;
  const corrected = rows.filter((r) => r.was_corrected).length;

  const months = new Map<string, { total: number; corrected: number }>();
  const clients = new Map<string, { total: number; corrected: number }>();
  for (const r of rows) {
    const m = (r.confirmed_at ?? "").slice(0, 7);
    const mb = months.get(m) ?? { total: 0, corrected: 0 };
    mb.total += 1;
    if (r.was_corrected) mb.corrected += 1;
    months.set(m, mb);

    const cb = clients.get(r.client_id) ?? { total: 0, corrected: 0 };
    cb.total += 1;
    if (r.was_corrected) cb.corrected += 1;
    clients.set(r.client_id, cb);
  }

  const clientIds = [...clients.keys()];
  const nameMap = new Map<string, string>();
  if (clientIds.length > 0) {
    const { data: clientRows } = await supabase
      .from("clients")
      .select("id, biz_name")
      .in("id", clientIds);
    for (const c of clientRows ?? []) nameMap.set(c.id, c.biz_name);
  }

  const byMonth: AccuracyBucket[] = [...months.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([key, v]) => ({
      key,
      label: key ? `${key.slice(0, 4)}.${key.slice(5, 7)}` : "—",
      total: v.total,
      corrected: v.corrected,
      accuracy: accuracy(v.total, v.corrected),
    }));

  const byClient = [...clients.entries()]
    .map(([clientId, v]) => ({
      clientId,
      key: clientId,
      label: nameMap.get(clientId) ?? "(거래처)",
      total: v.total,
      corrected: v.corrected,
      accuracy: accuracy(v.total, v.corrected),
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 20);

  return {
    overall: { total, corrected, accuracy: accuracy(total, corrected) },
    byMonth,
    byClient,
  };
}

export type AiUsageRow = {
  month: string;
  input_tokens: number;
  output_tokens: number;
  doc_count: number;
  est_cost_krw: number;
};

/** Owner-only AI usage rows (RLS), most recent months first. */
export async function getAiUsage(): Promise<AiUsageRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ai_usage")
    .select("month, input_tokens, output_tokens, doc_count, est_cost_krw")
    .order("month", { ascending: false })
    .limit(12);
  return data ?? [];
}
