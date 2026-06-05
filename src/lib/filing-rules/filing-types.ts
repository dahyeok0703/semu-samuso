/**
 * 신고 유형 레지스트리 (데이터 테이블).
 *
 * `filing_tasks.filing_type` 에 저장되는 안정적 코드 ↔ 한글 라벨 ↔ 카테고리 매핑.
 * 새 신고 유형은 이 표에만 추가하면 라벨/필터/문서템플릿이 함께 동작한다.
 */

export type FilingCategory =
  | "vat"
  | "vat_simplified"
  | "exempt_status"
  | "withholding"
  | "income"
  | "corporate"
  | "payment_statement";

export type FilingTypeCode =
  | "vat_1_preliminary"
  | "vat_1_final"
  | "vat_2_preliminary"
  | "vat_2_final"
  | "vat_simplified"
  | "exempt_status"
  | "withholding_monthly"
  | "withholding_semiannual"
  | "income"
  | "corporate"
  | "payment_statement_wage"
  | "payment_statement_business"
  | "simple_payment_statement_wage";

export type FilingTypeMeta = {
  label: string;
  category: FilingCategory;
};

export const FILING_TYPES: Record<FilingTypeCode, FilingTypeMeta> = {
  vat_1_preliminary: { label: "부가세 1기 예정", category: "vat" },
  vat_1_final: { label: "부가세 1기 확정", category: "vat" },
  vat_2_preliminary: { label: "부가세 2기 예정", category: "vat" },
  vat_2_final: { label: "부가세 2기 확정", category: "vat" },
  vat_simplified: { label: "부가세(간이) 확정", category: "vat_simplified" },
  exempt_status: { label: "사업장현황신고", category: "exempt_status" },
  withholding_monthly: { label: "원천세(매월)", category: "withholding" },
  withholding_semiannual: { label: "원천세(반기)", category: "withholding" },
  income: { label: "종합소득세", category: "income" },
  corporate: { label: "법인세", category: "corporate" },
  payment_statement_wage: { label: "지급명세서(근로·퇴직)", category: "payment_statement" },
  payment_statement_business: { label: "지급명세서(사업·기타)", category: "payment_statement" },
  simple_payment_statement_wage: { label: "간이지급명세서(근로)", category: "payment_statement" },
};

export const FILING_CATEGORY_LABELS: Record<FilingCategory, string> = {
  vat: "부가가치세",
  vat_simplified: "부가세(간이)",
  exempt_status: "사업장현황",
  withholding: "원천세",
  income: "종합소득세",
  corporate: "법인세",
  payment_statement: "지급명세서",
};

export function filingTypeLabel(code: string): string {
  return FILING_TYPES[code as FilingTypeCode]?.label ?? code;
}

export function filingTypeCategory(code: string): FilingCategory | null {
  return FILING_TYPES[code as FilingTypeCode]?.category ?? null;
}

/** Codes belonging to a category — used by calendar/list category filters. */
export function codesForCategory(category: FilingCategory): FilingTypeCode[] {
  return (Object.keys(FILING_TYPES) as FilingTypeCode[]).filter(
    (code) => FILING_TYPES[code].category === category,
  );
}

export const FILING_CATEGORY_OPTIONS = (
  Object.keys(FILING_CATEGORY_LABELS) as FilingCategory[]
).map((value) => ({ value, label: FILING_CATEGORY_LABELS[value] }));
