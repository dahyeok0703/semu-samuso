import { createClient } from "@/lib/supabase/server";
import type { DocumentStatus, Json } from "@/types/database.types";

export type ClientDocument = {
  id: string;
  doc_type: string | null;
  status: DocumentStatus;
  confidence: number | null;
  classified_by_ai: boolean;
  ai_model: string | null;
  ai_meta: Json;
  file_path: string;
  filing_task_id: string | null;
  received_at: string;
};

export async function listClientDocuments(clientId: string): Promise<ClientDocument[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("documents")
    .select(
      "id, doc_type, status, confidence, classified_by_ai, ai_model, ai_meta, file_path, filing_task_id, received_at",
    )
    .eq("client_id", clientId)
    .order("received_at", { ascending: false })
    .limit(200);
  return data ?? [];
}

export type TaskOption = { id: string; label: string };

/** Filing tasks for the client, for the document→task link dropdown. */
export async function listClientTaskOptions(clientId: string): Promise<TaskOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("filing_tasks")
    .select("id, filing_type, period_label, due_date")
    .eq("client_id", clientId)
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(100);
  return (data ?? []).map((t) => ({ id: t.id, label: `${t.period_label}` }));
}
