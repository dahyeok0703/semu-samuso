"use server";

import { revalidatePath } from "next/cache";

import { action, ActionException } from "@/lib/actions/safe-action";
import { logAudit } from "@/lib/audit";
import { getSession, type SessionContext } from "@/lib/auth/session";
import {
  markNotificationSchema,
  sendRemindersSchema,
  updateReminderSettingsSchema,
} from "@/lib/reminders/schemas";
import { getStaffForClient, loadReminderTask, sendRemindersForTask } from "@/lib/reminders/service";
import { createClient } from "@/lib/supabase/server";

async function getActor(): Promise<SessionContext> {
  const session = await getSession();
  if (!session) throw new ActionException("UNAUTHORIZED", "로그인이 필요합니다.");
  return session;
}

// ---------------------------------------------------------------------------
// Send reminders for selected tasks over chosen channels (bulk or individual).
// ---------------------------------------------------------------------------
export const sendRemindersAction = action(sendRemindersSchema, async ({ taskIds, channels }) => {
  const session = await getActor();
  const supabase = await createClient();

  // Non-owners may only send for clients they are assigned to.
  let allowedClientIds: Set<string> | null = null;
  if (session.member.role !== "owner") {
    const { data: assigned } = await supabase
      .from("client_assignments")
      .select("client_id")
      .eq("member_id", session.member.id);
    allowedClientIds = new Set((assigned ?? []).map((a) => a.client_id));
  }

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const taskId of taskIds) {
    const task = await loadReminderTask(supabase, taskId);
    if (!task) {
      skipped += 1;
      continue;
    }
    if (allowedClientIds && !allowedClientIds.has(task.clientId)) {
      skipped += 1;
      continue;
    }
    const staff = await getStaffForClient(supabase, task.clientId);
    const outcomes = await sendRemindersForTask(supabase, {
      workspaceId: session.workspace.id,
      officeName: session.workspace.name,
      task,
      channels,
      staffMemberIds: staff,
    });
    for (const o of outcomes) {
      if (o.status === "sent") sent += 1;
      else failed += 1;
    }
  }

  await logAudit({
    workspaceId: session.workspace.id,
    actorMemberId: session.member.id,
    action: "reminder.sent",
    meta: { tasks: taskIds.length, channels, sent, failed, skipped },
  });

  revalidatePath("/reminders");
  return { sent, failed, skipped };
});

// ---------------------------------------------------------------------------
// Reminder settings (auto-send, channels, offsets) — owner only.
// ---------------------------------------------------------------------------
export const updateReminderSettingsAction = action(
  updateReminderSettingsSchema,
  async ({ auto_send, channels, offsets }) => {
    const session = await getActor();
    if (session.member.role !== "owner") {
      throw new ActionException("FORBIDDEN", "리마인더 설정은 대표(owner)만 변경할 수 있습니다.");
    }
    const supabase = await createClient();

    const payload: {
      workspace_id: string;
      auto_send: boolean;
      channels: string[];
      offsets?: number[];
    } = { workspace_id: session.workspace.id, auto_send, channels };
    if (offsets) payload.offsets = offsets;

    const { error } = await supabase
      .from("reminder_settings")
      .upsert(payload, { onConflict: "workspace_id" });
    if (error) throw new ActionException("INTERNAL", "설정을 저장하지 못했습니다.");

    await logAudit({
      workspaceId: session.workspace.id,
      actorMemberId: session.member.id,
      action: "reminder.settings_updated",
      meta: { auto_send, channels, offsets: offsets ?? null },
    });

    revalidatePath("/reminders");
    return { auto_send, channels };
  },
);

// ---------------------------------------------------------------------------
// Notifications (header bell) — own only.
// ---------------------------------------------------------------------------
export const markNotificationReadAction = action(markNotificationSchema, async ({ id }) => {
  const session = await getActor();
  const supabase = await createClient();
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .is("read_at", null);
  return { id, workspaceId: session.workspace.id };
});

export async function markAllNotificationsRead(): Promise<{ ok: true }> {
  const session = await getSession();
  if (!session) return { ok: true };
  const supabase = await createClient();
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("member_id", session.member.id)
    .is("read_at", null);
  return { ok: true };
}
