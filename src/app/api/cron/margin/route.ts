import { NextResponse } from "next/server";

import { getMarginMonitor } from "@/lib/pricing/queries";
import { env, features, SUPERUSER_EMAILS } from "@/lib/env";
import { sendRawEmail } from "@/lib/messaging/channels";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 일/월 마진 모니터링 크론. 워크스페이스별 MRR vs COGS(AI+메시지+PG)로 마진율을
 * 계산해 margin_flags 에 적재하고, 목표치 미만으로 새로 플래그된 계정은 슈퍼유저에게
 * 이메일로 알린다(SMTP 미설정 시 로그). 멱등: 같은 달은 upsert.
 *
 * Auth: CRON_SECRET 설정 시 Bearer 검증.
 */
export async function GET(request: Request) {
  if (env.CRON_SECRET) {
    if (request.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
  } else if (env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false, error: "CRON_SECRET 미설정" }, { status: 503 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY 미설정" },
      { status: 503 },
    );
  }

  const monitor = await getMarginMonitor();
  if (!monitor.available) {
    return NextResponse.json({ ok: false, error: "monitor unavailable" }, { status: 503 });
  }

  const newlyFlagged: { name: string; marginRate: number | null }[] = [];

  for (const row of monitor.rows) {
    // Was this workspace already flagged+notified this month?
    const { data: prev } = await admin
      .from("margin_flags")
      .select("flagged, notified_at")
      .eq("workspace_id", row.workspaceId)
      .eq("month", monitor.month)
      .maybeSingle();

    const isNewAlert = row.margin.flagged && !(prev?.flagged && prev?.notified_at);

    await admin.from("margin_flags").upsert(
      {
        workspace_id: row.workspaceId,
        month: monitor.month,
        mrr_krw: row.margin.revenueKrw,
        cogs_krw: row.margin.cogsKrw,
        margin_rate: row.margin.marginRate,
        flagged: row.margin.flagged,
        notified_at: isNewAlert ? new Date().toISOString() : (prev?.notified_at ?? null),
      },
      { onConflict: "workspace_id,month" },
    );

    if (isNewAlert) newlyFlagged.push({ name: row.name, marginRate: row.margin.marginRate });
  }

  // Alert superusers about newly-flagged accounts.
  if (newlyFlagged.length > 0 && SUPERUSER_EMAILS.length > 0) {
    const lines = newlyFlagged
      .map(
        (f) =>
          `• ${f.name}: 마진 ${f.marginRate === null ? "—" : `${Math.round(f.marginRate * 100)}%`}`,
      )
      .join("\n");
    const body = `목표 마진 미만으로 새로 플래그된 워크스페이스 (${monitor.month}):\n\n${lines}\n\n/admin 마진 모니터에서 확인하세요.`;
    if (features.email) {
      for (const to of SUPERUSER_EMAILS) {
        await sendRawEmail(to, `[마진 경보] ${newlyFlagged.length}개 계정`, body).catch(
          () => undefined,
        );
      }
    } else {
      console.warn("[margin] newly flagged (email disabled):\n" + body);
    }
  }

  return NextResponse.json({
    ok: true,
    month: monitor.month,
    checked: monitor.rows.length,
    flagged: monitor.flaggedCount,
    newlyAlerted: newlyFlagged.length,
  });
}
