import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { classifyDocument, AiDisabledError } from "@/lib/ai/classify";
import { AUTO_CONFIRM_CONFIDENCE } from "@/lib/ai/schema";
import { getDailyClassifyCount, getMonthlyDocCount } from "@/lib/ai/usage";
import { decideDocQuota } from "@/lib/pricing/quota";
import { logAudit } from "@/lib/audit";
import { getSession } from "@/lib/auth/session";
import { getClientAssigneeIds } from "@/lib/clients/queries";
import { classifyRequestSchema } from "@/lib/documents/schemas";
import { DOCUMENTS_BUCKET, env, features } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database.types";

// Anthropic SDK + Buffer + storage download require the Node.js runtime.
export const runtime = "nodejs";

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status });
}

function guessContentType(path: string): string {
  const ext = path.toLowerCase().split(".").pop() ?? "";
  const map: Record<string, string> = {
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    gif: "image/gif",
  };
  return map[ext] ?? "application/octet-stream";
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return json({ ok: false, error: "로그인이 필요합니다." }, 401);

  // Graceful degradation: no key → manual classification only.
  if (!features.aiClassification) {
    return json(
      {
        ok: false,
        code: "AI_DISABLED",
        error: "자동 분류가 비활성화되어 있습니다. 수동으로 분류해 주세요.",
      },
      503,
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return json({ ok: false, error: "잘못된 요청입니다." }, 400);
  }
  const parsed = classifyRequestSchema.safeParse(raw);
  if (!parsed.success) return json({ ok: false, error: "documentId가 필요합니다." }, 400);

  const supabase = await createClient();
  const { data: doc } = await supabase
    .from("documents")
    .select("id, client_id, file_path")
    .eq("id", parsed.data.documentId)
    .maybeSingle();
  if (!doc) return json({ ok: false, error: "자료를 찾을 수 없습니다." }, 404);

  // Permission: owner or a member assigned to the client.
  if (session.member.role !== "owner") {
    const assignees = await getClientAssigneeIds(doc.client_id);
    if (!assignees.includes(session.member.id)) {
      return json({ ok: false, error: "권한이 없습니다." }, 403);
    }
  }

  // Per-workspace daily cost guard.
  const used = await getDailyClassifyCount(supabase, session.workspace.id);
  if (used >= env.AI_DAILY_CLASSIFY_LIMIT) {
    return json(
      {
        ok: false,
        code: "RATE_LIMITED",
        error: `일일 자동 분류 한도(${env.AI_DAILY_CLASSIFY_LIMIT}건)를 초과했습니다.`,
      },
      429,
    );
  }

  // ★마진 보호: 월 문서 쿼터 판정. 하드캡이면 분류 중단(수동 모드), 오버리지면 과금 후 진행.
  const monthlyUsed = await getMonthlyDocCount(supabase, session.workspace.id);
  const quota = decideDocQuota(session.workspace, monthlyUsed);
  if (quota.status === "blocked") {
    return json(
      {
        ok: false,
        code: "QUOTA_EXCEEDED",
        error: `이번 달 포함 문서 한도(${quota.includedDocs}건)를 모두 사용했습니다. 상위 플랜으로 업그레이드하거나 수동으로 분류해 주세요.`,
        includedDocs: quota.includedDocs,
        used: quota.used,
      },
      402,
    );
  }
  const overageUnitPriceKrw = quota.status === "overage" ? quota.overageUnitPriceKrw : undefined;

  const { data: client } = await supabase
    .from("clients")
    .select("id, biz_name, biz_reg_no")
    .eq("id", doc.client_id)
    .maybeSingle();
  if (!client) return json({ ok: false, error: "거래처를 찾을 수 없습니다." }, 404);

  // Download the file (storage RLS keeps this workspace-scoped).
  const { data: blob, error: dlErr } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .download(doc.file_path);
  if (dlErr || !blob) return json({ ok: false, error: "파일을 불러오지 못했습니다." }, 500);

  const bytes = new Uint8Array(await blob.arrayBuffer());
  const contentType = blob.type || guessContentType(doc.file_path);
  const fileName = doc.file_path.split("/").pop() ?? "document";

  try {
    const outcome = await classifyDocument({
      supabase,
      workspaceId: session.workspace.id,
      client: { id: client.id, bizName: client.biz_name, bizRegNo: client.biz_reg_no },
      bytes,
      contentType,
      fileName,
      overageUnitPriceKrw,
    });

    const c = outcome.classification;
    const status = c.confidence >= AUTO_CONFIRM_CONFIDENCE ? "confirmed" : "pending_review";
    const aiMeta: Json = {
      suggested_doc_type: c.doc_type,
      confidence: c.confidence,
      matched_client: c.matched_client,
      period_hint: c.period_hint,
      vendor: c.vendor,
      amount_band: c.amount_band,
      keywords: c.keywords,
      account_hint: c.account_hint,
      reasoning: c.reasoning,
      mode: outcome.mode,
      rag_count: outcome.ragCount,
    };

    await supabase
      .from("documents")
      .update({
        doc_type: c.doc_type,
        confidence: c.confidence,
        classified_by_ai: true,
        status,
        ai_model: outcome.model,
        ai_meta: aiMeta,
      })
      .eq("id", doc.id);

    await logAudit({
      workspaceId: session.workspace.id,
      actorMemberId: session.member.id,
      action: "ai.classified",
      targetTable: "documents",
      targetId: doc.id,
      meta: {
        doc_type: c.doc_type,
        confidence: c.confidence,
        model: outcome.model,
        mode: outcome.mode,
      },
    });

    revalidatePath(`/clients/${doc.client_id}`);
    return json({
      ok: true,
      docType: c.doc_type,
      confidence: c.confidence,
      status,
      model: outcome.model,
      overage: overageUnitPriceKrw !== undefined,
    });
  } catch (error) {
    if (error instanceof AiDisabledError) {
      return json({ ok: false, code: "AI_DISABLED", error: error.message }, 503);
    }
    console.error("[api/classify] failed:", error);
    return json({ ok: false, error: "분류에 실패했습니다. 수동으로 분류해 주세요." }, 500);
  }
}
