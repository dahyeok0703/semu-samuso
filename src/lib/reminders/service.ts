import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { filingTypeLabel } from "@/lib/filing-rules/filing-types";
import { sendViaChannel, type Channel, type SendRecipient } from "@/lib/messaging/channels";
import { daysUntil } from "@/lib/messaging/rules";
import { renderReminder, REMINDER_TEMPLATE_KEY } from "@/lib/messaging/templates";
import type { Database } from "@/types/database.types";

type Supa = SupabaseClient<Database>;

export type ReminderTask = {
  taskId: string;
  clientId: string;
  clientName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  filingLabel: string;
  dueDate: string;
  missingDocs: string[];
  daysLeft: number;
};

/** Load everything needed to send a reminder for one filing task (or null). */
export async function loadReminderTask(
  supabase: Supa,
  taskId: string,
): Promise<ReminderTask | null> {
  const { data: task } = await supabase
    .from("filing_tasks")
    .select("id, client_id, filing_type, period_label, due_date")
    .eq("id", taskId)
    .maybeSingle();
  if (!task || !task.due_date) return null;

  const { data: client } = await supabase
    .from("clients")
    .select("id, biz_name, contact_email, contact_phone, status")
    .eq("id", task.client_id)
    .maybeSingle();
  if (!client) return null;

  const { data: expected } = await supabase
    .from("expected_documents")
    .select("doc_type")
    .eq("filing_task_id", taskId)
    .eq("is_received", false);

  return {
    taskId: task.id,
    clientId: client.id,
    clientName: client.biz_name,
    contactEmail: client.contact_email,
    contactPhone: client.contact_phone,
    filingLabel: `${filingTypeLabel(task.filing_type)} ${task.period_label}`,
    dueDate: task.due_date,
    missingDocs: (expected ?? []).map((e) => e.doc_type),
    daysLeft: daysUntil(task.due_date),
  };
}

/** Staff to notify in-app: client assignees, or workspace owners if unassigned. */
export async function getStaffForClient(supabase: Supa, clientId: string): Promise<string[]> {
  const { data: assigned } = await supabase
    .from("client_assignments")
    .select("member_id")
    .eq("client_id", clientId);
  const ids = (assigned ?? []).map((a) => a.member_id);
  if (ids.length > 0) return ids;

  const { data: owners } = await supabase
    .from("members")
    .select("id")
    .eq("role", "owner")
    .eq("status", "active");
  return (owners ?? []).map((m) => m.id);
}

export type ChannelOutcome = {
  channel: Channel;
  status: "sent" | "failed";
  channelUsed: Channel;
  error: string | null;
  responseNote: string | null;
};

function dueDateLabel(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("ko-KR", { timeZone: "UTC" });
}

/**
 * Render + send a reminder for one task across the chosen channels, recording a
 * `reminders` row per channel. Used by both the page actions (user client) and
 * the daily cron (service-role client).
 */
export async function sendRemindersForTask(
  supabase: Supa,
  params: {
    workspaceId: string;
    officeName: string;
    task: ReminderTask;
    channels: Channel[];
    staffMemberIds: string[];
  },
): Promise<ChannelOutcome[]> {
  const { workspaceId, officeName, task, channels, staffMemberIds } = params;

  const rendered = renderReminder({
    officeName,
    clientName: task.clientName,
    contactName: `${task.clientName} 담당자님`,
    dueDateLabel: dueDateLabel(task.dueDate),
    filingLabel: task.filingLabel,
    missingDocs: task.missingDocs,
    daysLeft: task.daysLeft,
  });

  const recipient: SendRecipient = {
    email: task.contactEmail,
    phone: task.contactPhone,
    staffMemberIds,
  };
  const ctx = { workspaceId, clientId: task.clientId, link: `/clients/${task.clientId}` };

  const outcomes: ChannelOutcome[] = [];
  for (const channel of channels) {
    const result = await sendViaChannel(supabase, channel, rendered, recipient, ctx);
    await supabase.from("reminders").insert({
      workspace_id: workspaceId,
      client_id: task.clientId,
      filing_task_id: task.taskId,
      channel, // requested channel; response_note records any fallback
      template_key: REMINDER_TEMPLATE_KEY,
      status: result.status,
      sent_at: result.status === "sent" ? new Date().toISOString() : null,
      error: result.error,
      response_note: result.responseNote,
    });
    outcomes.push({
      channel,
      status: result.status,
      channelUsed: result.channelUsed,
      error: result.error,
      responseNote: result.responseNote,
    });
  }
  return outcomes;
}
