import { describe, expect, it } from "vitest";

import { DOC_TYPES } from "@/lib/ai/doc-types";
import {
  AUTO_CONFIRM_CONFIDENCE,
  CLASSIFICATION_JSON_SCHEMA,
  classificationSchema,
  FALLBACK_CONFIDENCE,
} from "@/lib/ai/schema";

const valid = {
  doc_type: "tax_invoice",
  confidence: 0.92,
  matched_client: { biz_name: "가나다상사", biz_reg_no: "1234567890", matches_current: true },
  period_hint: "2025-1기",
  vendor: "행복마트",
  amount_band: "1만~5만",
  keywords: ["간식", "음료"],
  account_hint: "복리후생비",
  reasoning: "공급가액·세액 표기",
};

describe("classificationSchema", () => {
  it("정상 결과를 파싱한다", () => {
    const r = classificationSchema.safeParse(valid);
    expect(r.success).toBe(true);
  });

  it("알 수 없는 doc_type 은 거부한다", () => {
    const r = classificationSchema.safeParse({ ...valid, doc_type: "unknown_kind" });
    expect(r.success).toBe(false);
  });

  it("confidence 범위를 강제한다 (0~1)", () => {
    expect(classificationSchema.safeParse({ ...valid, confidence: 1.5 }).success).toBe(false);
    expect(classificationSchema.safeParse({ ...valid, confidence: -0.1 }).success).toBe(false);
  });

  it("nullable 필드는 null 을 허용한다", () => {
    const r = classificationSchema.safeParse({
      ...valid,
      vendor: null,
      period_hint: null,
      account_hint: null,
      reasoning: null,
      matched_client: { biz_name: null, biz_reg_no: null, matches_current: false },
    });
    expect(r.success).toBe(true);
  });

  it("임계값 상수는 합리적 순서를 가진다", () => {
    expect(FALLBACK_CONFIDENCE).toBeLessThan(AUTO_CONFIRM_CONFIDENCE);
  });
});

describe("CLASSIFICATION_JSON_SCHEMA (structured output 계약)", () => {
  it("doc_type enum 이 doc-types 와 일치한다", () => {
    const props = CLASSIFICATION_JSON_SCHEMA.properties as Record<string, { enum?: string[] }>;
    expect(props.doc_type?.enum).toEqual([...DOC_TYPES]);
  });

  it("객체는 additionalProperties:false 이고 모든 속성이 required 다", () => {
    expect(CLASSIFICATION_JSON_SCHEMA.additionalProperties).toBe(false);
    const props = Object.keys(CLASSIFICATION_JSON_SCHEMA.properties as object);
    expect(new Set(CLASSIFICATION_JSON_SCHEMA.required as string[])).toEqual(new Set(props));
  });
});
