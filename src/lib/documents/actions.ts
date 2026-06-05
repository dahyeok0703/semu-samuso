"use server";

import { revalidatePath } from "next/cache";

import { action, ActionException } from "@/lib/actions/safe-action";
import type { DocType } from "@/lib/ai/doc-types";
import { logAudit } from "@/lib/audit";
import { requireActor as getActor } from "@/lib/auth/guards";
import { getClientAssigneeIds } from "@/lib/clients/queries";
import { deriveDocsStatus } from "@/lib/filings/constants";
import {
  confirmDocumentSchema,
  deleteDocumentSchema,
  linkDocumentTaskSchema,
  registerDocumentSchema,
} from "@/lib/documents/schemas";
import { DOCUMENTS_BUCKET } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { SessionContext } from "@/lib/auth/session";
import type { Json } from "@/types/database.types";

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

/** Owner, or a member assigned to the client, may write that client's documents. */
async function assertCanWriteClient(session: SessionContext, clientId: string): Promise<void> {
  if (session.member.role === "owner") return;
  const assignees = await getClientAssigneeIds(clientId);
  if (!assignees.includes(session.member.id)) {
    throw new ActionException("FORBIDDEN", "이 거래처의 자료를 변경할 권한이 없습니다.");
  }
}

/** Map a received doc_type to a keyword for matching expected_documents text. */
const DOC_MATCH_KEYWORD: Record<DocType, string | null> = {
  tax_invoice: "세금계산서",
  card_slip: "카드",
  receipt: "영수증",
  bankbook: "통장",
  payroll: "급여",
  other: null,
};

/**
 * ★누락 감지: expected_documents 대비 수취 documents 를 대조해 filing_task.docs_status
 * (missing/partial/complete)를 자동 갱신한다. 수동 체크는 보존하고, 연결된 확정
 * 서류와 doc_type 키워드가 일치하면 추가로 수취 처리한다.
 */
async function syncTaskDocsStatus(supabase: SupabaseServer, taskId: string): Promise<void> {
  const [{ data: expected }, { data: docs }] = await Promise.all([
    supabase
      .from("expected_documents")
      .select("id, doc_type, is_received")
      .eq("filing_task_id", taskId),
    supabase
      .from("documents")
      .select("doc_type")
      .eq("filing_task_id", taskId)
      .eq("status", "confirmed"),
  ]);

  const expectedRows = expected ?? [];
  if (expectedRows.length === 0) return;

  const receivedKeywords = new Set(
    (docs ?? [])
      .map((d) => DOC_MATCH_KEYWORD[(d.doc_type ?? "other") as DocType])
      .filter((k): k is string => Boolean(k)),
  );

  let received = 0;
  for (const row of expectedRows) {
    const autoMatched = [...receivedKeywords].some((kw) => row.doc_type.includes(kw));
    const isReceived = row.is_received || autoMatched;
    if (isReceived) received += 1;
    if (autoMatched && !row.is_received) {
      await supabase.from("expected_documents").update({ is_received: true }).eq("id", row.id);
    }
  }

  const docsStatus = deriveDocsStatus(received, expectedRows.length);
  await supabase.from("filing_tasks").update({ docs_status: docsStatus }).eq("id", taskId);
}

// ---------------------------------------------------------------------------
// Register an uploaded document (storage object already created client-side).
// ---------------------------------------------------------------------------
export const registerDocumentAction = action(registerDocumentSchema, async (input) => {
  const session = await getActor();
  await assertCanWriteClient(session, input.clientId);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("documents")
    .insert({
      workspace_id: session.workspace.id,
      client_id: input.clientId,
      file_path: input.filePath,
      source: "upload",
      status: "pending_review",
      ai_meta: { file_name: input.fileName, content_type: input.contentType } as Json,
    })
    .select("id")
    .single();

  if (error || !data) throw new ActionException("INTERNAL", "자료를 등록하지 못했습니다.");

  await logAudit({
    workspaceId: session.workspace.id,
    actorMemberId: session.member.id,
    action: "document.uploaded",
    targetTable: "documents",
    targetId: data.id,
    meta: { file_name: input.fileName },
  });

  revalidatePath(`/clients/${input.clientId}`);
  return { id: data.id };
});

// ---------------------------------------------------------------------------
// Confirm/correct a classification → write to classification_history (learning).
// ---------------------------------------------------------------------------
export const confirmDocumentAction = action(confirmDocumentSchema, async (input) => {
  const session = await getActor();
  const supabase = await createClient();

  const { data: doc } = await supabase
    .from("documents")
    .select("id, client_id, doc_type, ai_meta, filing_task_id")
    .eq("id", input.documentId)
    .maybeSingle();
  if (!doc) throw new ActionException("NOT_FOUND", "자료를 찾을 수 없습니다.");
  await assertCanWriteClient(session, doc.client_id);

  const meta = (doc.ai_meta ?? {}) as Record<string, unknown>;
  const suggested = typeof meta.suggested_doc_type === "string" ? meta.suggested_doc_type : null;
  const wasCorrected = suggested !== null && suggested !== input.docType;

  // Update the document to the confirmed type + linked task.
  const { data: updated, error } = await supabase
    .from("documents")
    .update({ doc_type: input.docType, status: "confirmed", filing_task_id: input.taskId })
    .eq("id", input.documentId)
    .select("id")
    .maybeSingle();
  if (error) throw new ActionException("INTERNAL", "확정하지 못했습니다.");
  if (!updated) throw new ActionException("FORBIDDEN", "이 자료를 변경할 권한이 없습니다.");

  // ★학습 기록: 최종 확정 결과를 classification_history 에 누적(다음 분류의 참고자료).
  const features: Json = {
    vendor: typeof meta.vendor === "string" ? meta.vendor : null,
    amount_band: typeof meta.amount_band === "string" ? meta.amount_band : null,
    keywords: Array.isArray(meta.keywords) ? meta.keywords : [],
  };
  await supabase.from("classification_history").insert({
    workspace_id: session.workspace.id,
    client_id: doc.client_id,
    doc_type: input.docType,
    account_hint: typeof meta.account_hint === "string" ? meta.account_hint : null,
    features,
    was_corrected: wasCorrected,
    source_document_id: input.documentId,
  });

  // ★누락 감지: 연결된 task(들)의 docs_status 갱신.
  if (doc.filing_task_id && doc.filing_task_id !== input.taskId) {
    await syncTaskDocsStatus(supabase, doc.filing_task_id);
  }
  if (input.taskId) await syncTaskDocsStatus(supabase, input.taskId);

  await logAudit({
    workspaceId: session.workspace.id,
    actorMemberId: session.member.id,
    action: wasCorrected ? "document.reclassified" : "document.confirmed",
    targetTable: "documents",
    targetId: input.documentId,
    meta: { doc_type: input.docType, was_corrected: wasCorrected },
  });

  revalidatePath(`/clients/${doc.client_id}`);
  return { id: input.documentId, docType: input.docType, wasCorrected };
});

// ---------------------------------------------------------------------------
// Link / unlink a document to a filing task.
// ---------------------------------------------------------------------------
export const linkDocumentTaskAction = action(linkDocumentTaskSchema, async (input) => {
  const session = await getActor();
  const supabase = await createClient();

  const { data: doc } = await supabase
    .from("documents")
    .select("client_id, filing_task_id")
    .eq("id", input.documentId)
    .maybeSingle();
  if (!doc) throw new ActionException("NOT_FOUND", "자료를 찾을 수 없습니다.");
  await assertCanWriteClient(session, doc.client_id);

  const { data: updated, error } = await supabase
    .from("documents")
    .update({ filing_task_id: input.taskId })
    .eq("id", input.documentId)
    .select("id")
    .maybeSingle();
  if (error) throw new ActionException("INTERNAL", "신고 연결을 변경하지 못했습니다.");
  if (!updated) throw new ActionException("FORBIDDEN", "권한이 없습니다.");

  const previous = doc.filing_task_id;
  if (previous && previous !== input.taskId) await syncTaskDocsStatus(supabase, previous);
  if (input.taskId) await syncTaskDocsStatus(supabase, input.taskId);

  revalidatePath(`/clients/${doc.client_id}`);
  return { id: input.documentId, taskId: input.taskId };
});

// ---------------------------------------------------------------------------
// Delete a document (owner only) — removes the storage object too.
// ---------------------------------------------------------------------------
export const deleteDocumentAction = action(deleteDocumentSchema, async (input) => {
  const session = await getActor();
  if (session.member.role !== "owner") {
    throw new ActionException("FORBIDDEN", "자료 삭제는 대표(owner)만 가능합니다.");
  }
  const supabase = await createClient();

  const { data: doc } = await supabase
    .from("documents")
    .select("client_id, file_path, filing_task_id")
    .eq("id", input.documentId)
    .maybeSingle();
  if (!doc) throw new ActionException("NOT_FOUND", "자료를 찾을 수 없습니다.");

  const { error } = await supabase.from("documents").delete().eq("id", input.documentId);
  if (error) throw new ActionException("INTERNAL", "자료를 삭제하지 못했습니다.");

  // Best-effort storage cleanup.
  await supabase.storage.from(DOCUMENTS_BUCKET).remove([doc.file_path]);
  if (doc.filing_task_id) await syncTaskDocsStatus(supabase, doc.filing_task_id);

  await logAudit({
    workspaceId: session.workspace.id,
    actorMemberId: session.member.id,
    action: "document.deleted",
    targetTable: "documents",
    targetId: input.documentId,
  });

  revalidatePath(`/clients/${doc.client_id}`);
  return { id: input.documentId };
});
