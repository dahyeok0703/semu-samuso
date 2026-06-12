"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { submitClassificationBatch, type BatchEnqueueItem } from "@/lib/ai/batch";
import { getMonthlyDocCount } from "@/lib/ai/usage";
import { action, ActionException } from "@/lib/actions/safe-action";
import { logAudit } from "@/lib/audit";
import { requireActor } from "@/lib/auth/guards";
import { getClientAssigneeIds } from "@/lib/clients/queries";
import { features } from "@/lib/env";
import { decideDocQuota } from "@/lib/pricing/quota";
import { createClient } from "@/lib/supabase/server";

const enqueueSchema = z.object({
  documentIds: z.array(z.string().uuid()).min(1).max(200),
});

/**
 * 급하지 않은 문서들을 Batch API 대기열에 넣는다(50% 할인 경로). 권한·하드캡 쿼터를
 * 검사하고, 허용된 건만 classification_jobs 에 적재 후 배치를 제출한다.
 */
export const enqueueBatchClassifyAction = action(enqueueSchema, async ({ documentIds }) => {
  const session = await requireActor();
  if (!features.aiClassification) {
    throw new ActionException("FORBIDDEN", "자동 분류가 비활성화되어 있습니다.");
  }
  const supabase = await createClient();

  const { data: docs } = await supabase
    .from("documents")
    .select("id, client_id, file_path")
    .in("id", documentIds);
  if (!docs || docs.length === 0)
    throw new ActionException("NOT_FOUND", "자료를 찾을 수 없습니다.");

  // Hard-cap quota: only enqueue what fits when the plan blocks on overflow.
  const used = await getMonthlyDocCount(supabase, session.workspace.id);
  const quota = decideDocQuota(session.workspace, used);
  let capacity = quota.policy === "hardcap" ? quota.remaining : docs.length;
  if (capacity <= 0) {
    throw new ActionException(
      "FORBIDDEN",
      `이번 달 포함 문서 한도(${quota.includedDocs}건)를 모두 사용했습니다.`,
    );
  }

  const isOwner = session.member.role === "owner";
  const items: BatchEnqueueItem[] = [];
  let skipped = 0;

  for (const doc of docs) {
    if (capacity <= 0) {
      skipped += 1;
      continue;
    }
    if (!isOwner) {
      const assignees = await getClientAssigneeIds(doc.client_id);
      if (!assignees.includes(session.member.id)) {
        skipped += 1;
        continue;
      }
    }
    const { data: client } = await supabase
      .from("clients")
      .select("biz_name, biz_reg_no")
      .eq("id", doc.client_id)
      .maybeSingle();
    if (!client) {
      skipped += 1;
      continue;
    }

    // Create the queue row first so submit can set its batch id.
    const { data: job, error } = await supabase
      .from("classification_jobs")
      .insert({
        workspace_id: session.workspace.id,
        document_id: doc.id,
        custom_id: crypto.randomUUID(),
        status: "pending",
      })
      .select("id")
      .single();
    if (error || !job) {
      skipped += 1;
      continue;
    }

    items.push({
      jobId: job.id,
      documentId: doc.id,
      clientId: doc.client_id,
      filePath: doc.file_path,
      bizName: client.biz_name,
      bizRegNo: client.biz_reg_no,
    });
    capacity -= 1;
  }

  if (items.length === 0) {
    throw new ActionException("FORBIDDEN", "대기열에 추가할 수 있는 자료가 없습니다.");
  }

  const { batchId, submitted } = await submitClassificationBatch(supabase, items);
  if (!batchId) {
    // Roll the rows back to pending-without-batch are effectively orphaned;
    // mark them failed so they don't linger.
    await supabase
      .from("classification_jobs")
      .update({ status: "failed" })
      .in(
        "id",
        items.map((i) => i.jobId),
      );
    throw new ActionException("INTERNAL", "배치 제출에 실패했습니다. 잠시 후 다시 시도해 주세요.");
  }

  await supabase
    .from("classification_jobs")
    .update({ batch_id: batchId, status: "submitted" })
    .in(
      "id",
      items.map((i) => i.jobId),
    );

  await logAudit({
    workspaceId: session.workspace.id,
    actorMemberId: session.member.id,
    action: "ai.batch_enqueued",
    meta: { submitted, skipped, batch_id: batchId },
  });

  revalidatePath("/clients");
  return { submitted, skipped };
});
