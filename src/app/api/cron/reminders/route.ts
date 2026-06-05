import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import type { Channel } from "@/lib/messaging/channels";
import { DEFAULT_CHANNELS, DEFAULT_OFFSETS } from "@/lib/messaging/rules";
import { getStaffForClient, loadReminderTask, sendRemindersForTask } from "@/lib/reminders/service";

export const runtime = "nodejs";
// Avoid any static optimization — this is invoked on a schedule.
export const dynamic = "force-dynamic";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function startOfTodayISO(): string {
  return `${todayISO()}T00:00:00Z`;
}

const VALID_CHANNELS = new Set<Channel>(["inapp", "email", "kakao", "sms"]);

/**
 * Daily reminder cron (Vercel Cron / Supabase cron). For each workspace it
 * finds tasks at exactly D-N (per settings) whose docs are incomplete, then:
 *   - auto_send ON  → sends over the configured channels
 *   - auto_send OFF → notifies staff in-app only ("알림만")
 * Idempotent per day: a task already reminded today is skipped.
 *
 * Auth: when CRON_SECRET is set, require `Authorization: Bearer <secret>`.
 */
export async function GET(request: Request) {
  if (env.CRON_SECRET) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${env.CRON_SECRET}`) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
  } else if (env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false, error: "CRON_SECRET 미설정" }, { status: 503 });
  }

  // Cross-workspace work requires the service role (bypasses RLS).
  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY 미설정 — 자동 독촉 비활성" },
      { status: 503 },
    );
  }

  const today = todayISO();
  const { data: workspaces } = await admin.from("workspaces").select("id, name");

  let processed = 0;
  let sent = 0;
  let failed = 0;
  let notified = 0;

  for (const ws of workspaces ?? []) {
    const { data: settingsRow } = await admin
      .from("reminder_settings")
      .select("auto_send, channels, offsets")
      .eq("workspace_id", ws.id)
      .maybeSingle();

    const autoSend = settingsRow?.auto_send ?? false;
    const offsets = settingsRow?.offsets ?? [...DEFAULT_OFFSETS];
    const channels: Channel[] = autoSend
      ? ((settingsRow?.channels ?? [...DEFAULT_CHANNELS]).filter((c): c is Channel =>
          VALID_CHANNELS.has(c as Channel),
        ) as Channel[])
      : ["inapp"]; // auto-send OFF → notify staff only

    if (channels.length === 0) continue;

    const targetDates = offsets.map((o) => addDays(today, o));
    const { data: tasks } = await admin
      .from("filing_tasks")
      .select("id, client_id, due_date, docs_status, status")
      .eq("workspace_id", ws.id)
      .in("due_date", targetDates)
      .neq("docs_status", "complete")
      .not("status", "in", "(filed,done)");

    for (const t of tasks ?? []) {
      // Idempotency: skip if any reminder for this task was created today.
      const { count } = await admin
        .from("reminders")
        .select("id", { count: "exact", head: true })
        .eq("filing_task_id", t.id)
        .gte("created_at", startOfTodayISO());
      if ((count ?? 0) > 0) continue;

      const task = await loadReminderTask(admin, t.id);
      if (!task) continue;

      const staff = await getStaffForClient(admin, task.clientId);
      const outcomes = await sendRemindersForTask(admin, {
        workspaceId: ws.id,
        officeName: ws.name,
        task,
        channels,
        staffMemberIds: staff,
      });
      processed += 1;
      for (const o of outcomes) {
        if (o.status === "sent") sent += 1;
        else failed += 1;
        if (o.channelUsed === "inapp" && o.status === "sent") notified += 1;
      }
    }
  }

  return NextResponse.json({ ok: true, date: today, processed, sent, failed, notified });
}
