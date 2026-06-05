import { z } from "zod";

import { DOC_TYPES } from "@/lib/ai/doc-types";

/**
 * Structured-output schema for document classification. Passed to the model via
 * `zodOutputFormat` so the response is constrained to valid JSON (no free-form
 * text). The SDK strips constraints the API can't enforce (min/max/length) and
 * re-validates them client-side.
 */
export const classificationSchema = z.object({
  /** 분류 결과 (서류 종류). */
  doc_type: z.enum(DOC_TYPES),
  /** 0~1 신뢰도. 낮으면 사람이 검토(pending_review). */
  confidence: z.number().min(0).max(1),
  /** 문서에서 읽어낸 거래처 식별 + 현재 거래처와 일치 여부. */
  matched_client: z.object({
    biz_name: z.string().nullable(),
    biz_reg_no: z.string().nullable(),
    matches_current: z.boolean(),
  }),
  /** 귀속 신고기간 추정(예: "2025-1기", "2025-03"). 모르면 null. */
  period_hint: z.string().nullable(),
  /** 발행처/거래처명 — RAG 검색 feature 로만 사용(원문 전송 아님). */
  vendor: z.string().nullable(),
  /** 금액대(예: "1만~5만", "100만 이상"). */
  amount_band: z.string().nullable(),
  /** 검색용 키워드(품목/계정 단서). */
  keywords: z.array(z.string()).max(8),
  /** 추천 계정과목 단서. */
  account_hint: z.string().nullable(),
  /** 한 줄 근거(짧게). */
  reasoning: z.string().nullable(),
});

export type Classification = z.infer<typeof classificationSchema>;

/**
 * JSON Schema sent to the API via `output_config.format` (structured outputs).
 * Hand-written to match `classificationSchema` (the project uses Zod v3, while
 * the SDK's `zodOutputFormat` helper expects Zod v4). All objects use
 * additionalProperties:false and list every property in `required`.
 */
export const CLASSIFICATION_JSON_SCHEMA: { [key: string]: unknown } = {
  type: "object",
  additionalProperties: false,
  properties: {
    doc_type: { type: "string", enum: [...DOC_TYPES] },
    confidence: { type: "number" },
    matched_client: {
      type: "object",
      additionalProperties: false,
      properties: {
        biz_name: { type: ["string", "null"] },
        biz_reg_no: { type: ["string", "null"] },
        matches_current: { type: "boolean" },
      },
      required: ["biz_name", "biz_reg_no", "matches_current"],
    },
    period_hint: { type: ["string", "null"] },
    vendor: { type: ["string", "null"] },
    amount_band: { type: ["string", "null"] },
    keywords: { type: "array", items: { type: "string" } },
    account_hint: { type: ["string", "null"] },
    reasoning: { type: ["string", "null"] },
  },
  required: [
    "doc_type",
    "confidence",
    "matched_client",
    "period_hint",
    "vendor",
    "amount_band",
    "keywords",
    "account_hint",
    "reasoning",
  ],
};

/** confidence 이 값 미만이면 Sonnet 으로 1회 폴백. */
export const FALLBACK_CONFIDENCE = 0.6;
/** confidence 이 값 이상이면 자동 확정(status=confirmed), 미만은 pending_review. */
export const AUTO_CONFIRM_CONFIDENCE = 0.85;
