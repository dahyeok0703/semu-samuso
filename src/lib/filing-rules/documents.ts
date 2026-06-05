/**
 * 신고 유형별 기본 제출서류 템플릿 (데이터 테이블).
 *
 * generateFilingTasks 가 각 task 에 expected_documents 를 자동 세팅할 때 사용한다.
 * ⚠️ 일반 케이스 기준 예시이며, 업종/거래처별로 가감이 필요하다(세무사 검수 필요).
 */

import type { FilingCategory } from "@/lib/filing-rules/filing-types";

export const EXPECTED_DOCS_BY_CATEGORY: Record<FilingCategory, readonly string[]> = {
  vat: [
    "매출 세금계산서",
    "매입 세금계산서",
    "매출 신용카드/현금영수증 내역",
    "매입 신용카드/현금영수증 내역",
    "사업용 통장 거래내역",
  ],
  vat_simplified: ["매출 내역", "매입 세금계산서/영수증", "사업용 통장 거래내역"],
  exempt_status: ["수입금액(매출) 내역", "매입 세금계산서", "임대료/관리비 내역"],
  withholding: ["급여대장", "원천징수 내역", "사업/기타소득 지급 내역"],
  income: ["장부/재무제표", "소득·세액공제 증빙", "원천징수영수증"],
  corporate: ["재무제표", "세무조정 자료", "법인 통장 거래내역", "고정자산/감가상각 명세"],
  payment_statement: ["지급 내역(인적사항 포함)", "원천징수부"],
};

export function expectedDocsFor(category: FilingCategory): string[] {
  return [...EXPECTED_DOCS_BY_CATEGORY[category]];
}
