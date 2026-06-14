import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { verifySolapiSignature } from "@/lib/integrations/solapi/client";
import { captureException } from "@/lib/observability/report";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { clientIpFrom, guard } from "@/lib/security/request";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Solapi 발송 결과(딜리버리 리포트) 콜백. groupId 로 보낸 reminders 의 상태를 갱신한다.
 * 서명 시크릿이 있으면 검증, 없으면 dev 에서만 허용. 본 시스템 영향 0: 실패해도 200 ack.
 */
export async function POST(request: Request) {
  const ip = clientIpFrom(request.headers);
  if (!guard(`solapi-webhook:${ip}`, RATE_LIMITS.webhook).ok) {
    return NextResponse.json({ ok: false, error: "rate limited" }, { status: 429 });
  }

  const rawBody = await request.text();

  if (env.SOLAPI_WEBHOOK_SECRET) {
    const sig = request.headers.get("x-solapi-signature") ?? request.headers.get("signature") ?? "";
    if (!verifySolapiSignature(env.SOLAPI_WEBHOOK_SECRET, rawBody, sig)) {
      return NextResponse.json({ ok: false, error: "invalid signature" }, { status: 401 });
    }
  } else if (env.NODE_ENV === "production") {
    // No secret in prod → accept-but-noop (don't trust unsigned reports).
    return NextResponse.json({ ok: true, note: "SOLAPI_WEBHOOK_SECRET 미설정 — 무시" });
  }

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ ok: true, note: "service role 미설정 — 무시" });

  // Solapi reports come as an array (or single object) of delivery results.
  let reports: Array<Record<string, unknown>>;
  try {
    const parsed = JSON.parse(rawBody) as unknown;
    reports = Array.isArray(parsed)
      ? (parsed as Array<Record<string, unknown>>)
      : [parsed as Record<string, unknown>];
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }

  let updated = 0;
  try {
    for (const rep of reports) {
      const groupId = (rep.groupId ?? rep.group_id) as string | undefined;
      const statusCode = (rep.statusCode ?? rep.status) as string | undefined;
      if (!groupId) continue;
      const delivered = statusCode === undefined || statusCode === "4000"; // 4000 = 성공
      const { data } = await admin
        .from("reminders")
        .update({
          status: delivered ? "sent" : "failed",
          error: delivered ? null : `solapi status ${statusCode}`,
        })
        .eq("response_note", `solapi:${groupId}`)
        .select("id");
      updated += data?.length ?? 0;
    }
  } catch (error) {
    await captureException(error, { tags: { route: "webhooks/solapi" } });
  }

  return NextResponse.json({ ok: true, updated });
}
