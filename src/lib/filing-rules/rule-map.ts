/**
 * "과세유형 → 규칙 세트" 매핑 테이블.
 *
 * 하드코딩 금지 원칙: 어떤 거래처에 어떤 신고가 발생하는지를 이 표 하나로 정의한다.
 * 플래그(반기 원천징수·성실신고)는 각 빌더 내부에서 반영된다(rules.ts).
 *
 * ⚠️ 일반 케이스 기준입니다. 실제 적용 대상(예: 원천세·지급명세서 발생 여부)은
 *    거래처별 고용/지급 현황에 따라 다르므로 세무사 검수가 필요합니다.
 */

import {
  buildCorporate,
  buildExemptStatus,
  buildIncome,
  buildPaymentStatements,
  buildVatCorporate,
  buildVatIndividual,
  buildVatSimplified,
  buildWithholding,
} from "@/lib/filing-rules/rules";
import type { RuleBuilder } from "@/lib/filing-rules/types";
import type { TaxType } from "@/types/database.types";

export const RULE_SETS: Record<TaxType, RuleBuilder[]> = {
  // 일반과세(개인): 부가세 2회 + 종소세 + 원천세 + 지급명세서
  general: [buildVatIndividual, buildIncome, buildWithholding, buildPaymentStatements],
  // 간이과세(개인): 부가세(간이) 1회 + 종소세 + 원천세 + 지급명세서
  simplified: [buildVatSimplified, buildIncome, buildWithholding, buildPaymentStatements],
  // 면세사업자: 사업장현황신고 + 종소세 + 원천세 + 지급명세서 (부가세 없음)
  exempt: [buildExemptStatus, buildIncome, buildWithholding, buildPaymentStatements],
  // 법인: 부가세 4회 + 법인세 + 원천세 + 지급명세서 (종소세 없음)
  corporate: [buildVatCorporate, buildCorporate, buildWithholding, buildPaymentStatements],
};

export function selectRuleBuilders(taxType: TaxType | null): RuleBuilder[] {
  if (!taxType) return [];
  return RULE_SETS[taxType] ?? [];
}
