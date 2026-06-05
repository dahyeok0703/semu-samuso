/**
 * 수취 서류 분류 체계 (doc_type).
 * 안정적 코드 ↔ 한글 라벨. 분류 결과/학습 이력에 코드로 저장한다.
 */
export const DOC_TYPES = [
  "tax_invoice", // 세금계산서
  "card_slip", // 카드매출전표
  "receipt", // 영수증/간이영수증
  "bankbook", // 통장(거래내역)
  "payroll", // 급여대장
  "other", // 기타
] as const;

export type DocType = (typeof DOC_TYPES)[number];

export const DOC_TYPE_LABELS: Record<DocType, string> = {
  tax_invoice: "세금계산서",
  card_slip: "카드매출전표",
  receipt: "영수증",
  bankbook: "통장(거래내역)",
  payroll: "급여대장",
  other: "기타",
};

export const DOC_TYPE_OPTIONS = DOC_TYPES.map((value) => ({
  value,
  label: DOC_TYPE_LABELS[value],
}));

export function docTypeLabel(code: string | null): string {
  if (!code) return "미분류";
  return DOC_TYPE_LABELS[code as DocType] ?? code;
}
