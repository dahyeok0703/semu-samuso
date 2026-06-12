import { NextResponse } from "next/server";

import { harvestBatches } from "@/lib/ai/batch";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Batch API 하베스트 크론: 제출된 분류 배치(classification_jobs.status='submitted')를
 * 폴링해 끝난 것의 결과를 문서에 반영하고 사용량(50% 할인 원가)을 적재한다.
 * 멱등: 이미 done/failed 처리된 job 은 건너뛴다.
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

  try {
    const result = await harvestBatches(admin);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[ai-batch] harvest failed:", error);
    return NextResponse.json({ ok: false, error: "harvest error" }, { status: 500 });
  }
}
