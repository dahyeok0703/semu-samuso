import "server-only";

import type Anthropic from "@anthropic-ai/sdk";

import { estimateCostKrw, getAnthropic, PRIMARY_MODEL } from "@/lib/ai/client";
import { prepareDocumentContent } from "@/lib/ai/extract";
import { buildUserContent, SYSTEM_PROMPT } from "@/lib/ai/prompt";
import { getRagContext } from "@/lib/ai/rag";
import {
  classificationSchema,
  CLASSIFICATION_JSON_SCHEMA,
  AUTO_CONFIRM_CONFIDENCE,
  type Classification,
} from "@/lib/ai/schema";
import { recordAiUsage } from "@/lib/ai/usage";
import { DOCUMENTS_BUCKET } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

/**
 * Batch API 분류 경로 (급하지 않은 분류 50% 할인). 동기 /api/classify 와 달리
 * 결과를 즉시 받지 않고 대기열(classification_jobs)에 넣어 제출하고, 하베스트
 * 크론이 결과를 반영한다. 비용은 cogs.ts 의 BATCH_DISCOUNT(0.5)로 계산된다.
 */

type Supa = Awaited<ReturnType<typeof createClient>>;
type Admin = SupabaseClient<Database>;

export type BatchEnqueueItem = {
  jobId: string;
  documentId: string;
  clientId: string;
  filePath: string;
  bizName: string;
  bizRegNo: string | null;
};

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

/**
 * Prepare each item and submit one message batch. Returns the provider batch id
 * (or null when AI is disabled / nothing prepared).
 */
export async function submitClassificationBatch(
  supabase: Supa,
  items: BatchEnqueueItem[],
): Promise<{ batchId: string | null; submitted: number }> {
  const anthropic = getAnthropic();
  if (!anthropic || items.length === 0) return { batchId: null, submitted: 0 };

  const requests: Anthropic.Messages.Batches.BatchCreateParams.Request[] = [];

  for (const item of items) {
    const { data: blob } = await supabase.storage.from(DOCUMENTS_BUCKET).download(item.filePath);
    if (!blob) continue;
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const contentType = blob.type || guessContentType(item.filePath);
    const fileName = item.filePath.split("/").pop() ?? "document";

    const prepared = await prepareDocumentContent(bytes, contentType, fileName);
    const examples = await getRagContext(supabase, item.clientId);
    const userContent = buildUserContent(
      { bizName: item.bizName, bizRegNo: item.bizRegNo },
      examples,
      prepared.blocks,
    );

    requests.push({
      custom_id: item.jobId,
      params: {
        model: PRIMARY_MODEL,
        max_tokens: 1024,
        system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: userContent }],
        output_config: { format: { type: "json_schema", schema: CLASSIFICATION_JSON_SCHEMA } },
      },
    });
  }

  if (requests.length === 0) return { batchId: null, submitted: 0 };

  const batch = await anthropic.messages.batches.create({ requests });
  return { batchId: batch.id, submitted: requests.length };
}

function parseClassification(message: Anthropic.Message): Classification | null {
  const text = message.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("")
    .trim();
  try {
    const result = classificationSchema.safeParse(JSON.parse(text));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

/**
 * Poll submitted batches and apply any that have finished. Service-role client
 * (cron) so it can read/update across the queue. Idempotent: a job is only
 * applied while status='submitted', then flipped to done/failed.
 */
export async function harvestBatches(
  admin: Admin,
): Promise<{ batches: number; done: number; failed: number }> {
  const anthropic = getAnthropic();
  if (!anthropic) return { batches: 0, done: 0, failed: 0 };

  const { data: pending } = await admin
    .from("classification_jobs")
    .select("batch_id")
    .eq("status", "submitted")
    .not("batch_id", "is", null);

  const batchIds = [...new Set((pending ?? []).map((j) => j.batch_id).filter(Boolean))] as string[];
  let done = 0;
  let failed = 0;

  for (const batchId of batchIds) {
    const batch = await anthropic.messages.batches.retrieve(batchId);
    if (batch.processing_status !== "ended") continue;

    for await (const entry of await anthropic.messages.batches.results(batchId)) {
      const jobId = entry.custom_id;
      const { data: job } = await admin
        .from("classification_jobs")
        .select("id, workspace_id, document_id, status")
        .eq("id", jobId)
        .maybeSingle();
      if (!job || job.status !== "submitted") continue;

      if (entry.result.type !== "succeeded") {
        await admin.from("classification_jobs").update({ status: "failed" }).eq("id", jobId);
        failed += 1;
        continue;
      }

      const message = entry.result.message;
      const parsed = parseClassification(message);
      const u = message.usage;
      const cacheRead = u.cache_read_input_tokens ?? 0;
      await recordAiUsage(job.workspace_id, {
        inputTokens: u.input_tokens,
        outputTokens: u.output_tokens,
        cacheReadTokens: cacheRead,
        // ★ batch=true → 50% 할인된 원가.
        costKrw: estimateCostKrw(PRIMARY_MODEL, u.input_tokens, u.output_tokens, cacheRead, true),
      });

      if (!parsed) {
        await admin.from("classification_jobs").update({ status: "failed" }).eq("id", jobId);
        failed += 1;
        continue;
      }

      const status = parsed.confidence >= AUTO_CONFIRM_CONFIDENCE ? "confirmed" : "pending_review";
      const aiMeta: Json = {
        suggested_doc_type: parsed.doc_type,
        confidence: parsed.confidence,
        matched_client: parsed.matched_client,
        period_hint: parsed.period_hint,
        mode: "batch",
      };
      await admin
        .from("documents")
        .update({
          doc_type: parsed.doc_type,
          confidence: parsed.confidence,
          classified_by_ai: true,
          status,
          ai_model: PRIMARY_MODEL,
          ai_meta: aiMeta,
        })
        .eq("id", job.document_id);

      await admin.from("classification_jobs").update({ status: "done" }).eq("id", jobId);
      done += 1;
    }
  }

  return { batches: batchIds.length, done, failed };
}
