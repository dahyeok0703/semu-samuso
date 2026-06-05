import "server-only";

import type Anthropic from "@anthropic-ai/sdk";

import { estimateCostKrw, FALLBACK_MODEL, getAnthropic, PRIMARY_MODEL } from "@/lib/ai/client";
import { prepareDocumentContent } from "@/lib/ai/extract";
import { buildUserContent, SYSTEM_PROMPT, type ClientContext } from "@/lib/ai/prompt";
import { getRagContext } from "@/lib/ai/rag";
import {
  classificationSchema,
  CLASSIFICATION_JSON_SCHEMA,
  FALLBACK_CONFIDENCE,
  type Classification,
} from "@/lib/ai/schema";
import { recordAiUsage } from "@/lib/ai/usage";
import type { createClient } from "@/lib/supabase/server";

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

/** Thrown when auto-classification is disabled (no ANTHROPIC_API_KEY). */
export class AiDisabledError extends Error {
  constructor() {
    super("자동 분류가 비활성화되어 있습니다 (ANTHROPIC_API_KEY 미설정).");
    this.name = "AiDisabledError";
  }
}

export type ClassifyOutcome = {
  classification: Classification;
  model: string;
  mode: "text" | "vision" | "pdf";
  ragCount: number;
};

type CallResult = { parsed: Classification | null; usage: Anthropic.Usage };

/**
 * Classify one document with RAG context. Uses Haiku first; falls back to
 * Sonnet once on parse failure or low confidence. Records token usage to
 * ai_usage. System prompt is prompt-cached (cache_control on the system block).
 */
export async function classifyDocument(args: {
  supabase: SupabaseServer;
  workspaceId: string;
  client: ClientContext & { id: string };
  bytes: Uint8Array;
  contentType: string;
  fileName: string;
}): Promise<ClassifyOutcome> {
  const anthropic = getAnthropic();
  if (!anthropic) throw new AiDisabledError();

  const prepared = await prepareDocumentContent(args.bytes, args.contentType, args.fileName);
  const examples = await getRagContext(args.supabase, args.client.id);
  const userContent = buildUserContent(
    { bizName: args.client.bizName, bizRegNo: args.client.bizRegNo },
    examples,
    prepared.blocks,
  );

  // Stable system prompt is cached; volatile RAG/doc content goes in messages.
  const system: Anthropic.TextBlockParam[] = [
    { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
  ];
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: userContent }];

  let totalCost = 0;
  let totalInput = 0;
  let totalOutput = 0;

  async function call(model: string): Promise<CallResult> {
    const res = await anthropic!.messages.create({
      model,
      max_tokens: 1024,
      system,
      messages,
      output_config: { format: { type: "json_schema", schema: CLASSIFICATION_JSON_SCHEMA } },
    });
    const u = res.usage;
    const cacheRead = u.cache_read_input_tokens ?? 0;
    totalInput += u.input_tokens + cacheRead;
    totalOutput += u.output_tokens;
    totalCost += estimateCostKrw(model, u.input_tokens, u.output_tokens, cacheRead);

    // Structured output → JSON text block. Parse defensively with our zod schema.
    const text = res.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();
    let parsed: Classification | null = null;
    try {
      const result = classificationSchema.safeParse(JSON.parse(text));
      if (result.success) parsed = result.data;
    } catch {
      parsed = null;
    }
    return { parsed, usage: u };
  }

  let parsed: Classification | null = null;
  let model = PRIMARY_MODEL;
  try {
    parsed = (await call(PRIMARY_MODEL)).parsed;
  } catch (error) {
    console.error("[classify] primary call failed:", error);
  }

  // Fallback to Sonnet once on parse failure or low confidence.
  if (!parsed || parsed.confidence < FALLBACK_CONFIDENCE) {
    try {
      const fb = await call(FALLBACK_MODEL);
      if (fb.parsed) {
        parsed = fb.parsed;
        model = FALLBACK_MODEL;
      }
    } catch (error) {
      console.error("[classify] fallback call failed:", error);
    }
  }

  await recordAiUsage(args.workspaceId, {
    inputTokens: totalInput,
    outputTokens: totalOutput,
    costKrw: totalCost,
  });

  if (!parsed) {
    throw new Error("문서를 분류하지 못했습니다 (응답 파싱 실패).");
  }

  return { classification: parsed, model, mode: prepared.mode, ragCount: examples.length };
}
