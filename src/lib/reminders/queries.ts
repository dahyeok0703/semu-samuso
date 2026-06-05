import { cache } from "react";

import { filingTypeLabel } from "@/lib/filing-rules/filing-types";
import { DEFAULT_CHANNELS, DEFAULT_OFFSETS, daysUntil, matchOffset } from "@/lib/messaging/rules";
import { createClient } from "@/lib/supabase/server";

export type ReminderSettings = {
  auto_send: boolean;
  channels: string[];
  offsets: number[];
};

export async function getReminderSettings(): Promise<ReminderSettings> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("reminder_settings")
    .select("auto_send, channels, offsets")
    .limit(1)
    .maybeSingle();
  return {
    auto_send: data?.auto_send ?? false,
    channels: data?.channels ?? [...DEFAULT_CHANNELS],
    offsets: data?.offsets ?? [...DEFAULT_OFFSETS],
  };
}

export type ReminderCandidate = {
  taskId: string;
  clientId: string;
  clientName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  filingType: string;
  filingLabel: string;
  periodLabel: string;
  dueDate: string;
  docsStatus: string;
  daysLeft: number;
  matchedOffset: number | null;
  missingDocs: string[];
};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Reminder candidates: active clients' filing tasks within the offset window
 * whose docs are not complete. `matchedOffset` is non-null on exact D-N days.
 */
export async function listReminderCandidates(
  offsets: number[] = [...DEFAULT_OFFSETS],
): Promise<ReminderCandidate[]> {
  const supabase = await createClient();
  const today = todayISO();
  const maxOffset = Math.max(...offsets, 1);
  const horizon = addDays(today, maxOffset);

  const { data: tasks } = await supabase
    .from("filing_tasks")
    .select("id, client_id, filing_type, period_label, due_date, docs_status, status")
    .gte("due_date", today)
    .lte("due_date", horizon)
    .neq("docs_status", "complete")
    .not("status", "in", "(filed,done)")
    .order("due_date", { ascending: true });

  const rows = tasks ?? [];
  if (rows.length === 0) return [];

  const clientIds = [...new Set(rows.map((t) => t.client_id))];
  const taskIds = rows.map((t) => t.id);

  const [{ data: clients }, { data: expected }] = await Promise.all([
    supabase
      .from("clients")
      .select("id, biz_name, contact_email, contact_phone, status")
      .in("id", clientIds),
    supabase
      .from("expected_documents")
      .select("filing_task_id, doc_type, is_received")
      .in("filing_task_id", taskIds)
      .eq("is_received", false),
  ]);

  const clientMap = new Map((clients ?? []).map((c) => [c.id, c]));
  const missingByTask = new Map<string, string[]>();
  for (const e of expected ?? []) {
    const list = missingByTask.get(e.filing_task_id) ?? [];
    list.push(e.doc_type);
    missingByTask.set(e.filing_task_id, list);
  }

  const candidates: ReminderCandidate[] = [];
  for (const t of rows) {
    const client = clientMap.get(t.client_id);
    if (!client || client.status !== "active" || !t.due_date) continue;
    const daysLeft = daysUntil(t.due_date, today);
    candidates.push({
      taskId: t.id,
      clientId: t.client_id,
      clientName: client.biz_name,
      contactEmail: client.contact_email,
      contactPhone: client.contact_phone,
      filingType: t.filing_type,
      filingLabel: `${filingTypeLabel(t.filing_type)} ${t.period_label}`,
      periodLabel: t.period_label,
      dueDate: t.due_date,
      docsStatus: t.docs_status,
      daysLeft,
      matchedOffset: matchOffset(daysLeft, offsets),
      missingDocs: missingByTask.get(t.id) ?? [],
    });
  }
  return candidates;
}

export type ReminderHistoryRow = {
  id: string;
  client_id: string;
  client_name: string;
  channel: string;
  template_key: string;
  status: string;
  error: string | null;
  response_note: string | null;
  sent_at: string | null;
  created_at: string;
};

export async function listRecentReminders(limit = 100): Promise<ReminderHistoryRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("reminders")
    .select(
      "id, client_id, channel, template_key, status, error, response_note, sent_at, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  const rows = data ?? [];
  if (rows.length === 0) return [];
  const clientIds = [...new Set(rows.map((r) => r.client_id))];
  const { data: clients } = await supabase
    .from("clients")
    .select("id, biz_name")
    .in("id", clientIds);
  const nameMap = new Map((clients ?? []).map((c) => [c.id, c.biz_name]));
  return rows.map((r) => ({ ...r, client_name: nameMap.get(r.client_id) ?? "(거래처)" }));
}

// --- notifications (header bell) --------------------------------------------
export type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

export const getMyNotifications = cache(async (): Promise<NotificationRow[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("id, type, title, body, link, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(20);
  return data ?? [];
});
