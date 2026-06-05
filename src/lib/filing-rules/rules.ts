/**
 * 신고 규칙 빌더 (데이터 + 함수).
 *
 * 각 빌더는 (연도 + 거래처 속성) → 신고기한(보정 전 baseDueDate) 목록을 만든다.
 * 거래처 플래그(반기 원천징수·성실신고)와 결산월이 여기서 반영된다.
 *
 * ⚠️⚠️ 아래 기한은 모두 **일반 케이스 기준 시드값(예시)** 입니다.
 *      세무사 검수 및 개정세법 반영이 반드시 필요합니다.
 *
 * `year` 의 의미: **과세연도(귀속연도)**. 해당 연도 사업활동에서 발생하는 신고
 * 의무를 만들며, 일부 기한은 다음 해로 넘어간다(예: 2기 확정 = 익년 1/25).
 */

import { endOfMonth, toISO } from "@/lib/filing-rules/dates";
import type { RuleBuilder } from "@/lib/filing-rules/types";

// --- 부가가치세 -------------------------------------------------------------
// 일반(개인): 확정 2회 (예정고지). 1기확정 7/25, 2기확정 익년 1/25.
export const buildVatIndividual: RuleBuilder = ({ year }) => [
  { filingType: "vat_1_final", periodLabel: `${year}년 1기 확정`, baseDueDate: toISO(year, 7, 25) },
  {
    filingType: "vat_2_final",
    periodLabel: `${year}년 2기 확정`,
    baseDueDate: toISO(year + 1, 1, 25),
  },
];

// 법인: 예정·확정 4회. 1기예정 4/25, 1기확정 7/25, 2기예정 10/25, 2기확정 익년 1/25.
export const buildVatCorporate: RuleBuilder = ({ year }) => [
  {
    filingType: "vat_1_preliminary",
    periodLabel: `${year}년 1기 예정`,
    baseDueDate: toISO(year, 4, 25),
  },
  { filingType: "vat_1_final", periodLabel: `${year}년 1기 확정`, baseDueDate: toISO(year, 7, 25) },
  {
    filingType: "vat_2_preliminary",
    periodLabel: `${year}년 2기 예정`,
    baseDueDate: toISO(year, 10, 25),
  },
  {
    filingType: "vat_2_final",
    periodLabel: `${year}년 2기 확정`,
    baseDueDate: toISO(year + 1, 1, 25),
  },
];

// 간이: 연 1회, 익년 1/25.
export const buildVatSimplified: RuleBuilder = ({ year }) => [
  {
    filingType: "vat_simplified",
    periodLabel: `${year}년 확정`,
    baseDueDate: toISO(year + 1, 1, 25),
  },
];

// --- 사업장현황신고 (면세) --------------------------------------------------
// 익년 2/10.
export const buildExemptStatus: RuleBuilder = ({ year }) => [
  {
    filingType: "exempt_status",
    periodLabel: `${year}년 귀속`,
    baseDueDate: toISO(year + 1, 2, 10),
  },
];

// --- 원천세 -----------------------------------------------------------------
// 반기납부: 상반기 7/10, 하반기 익년 1/10. 일반: 매월 10일(익월).
export const buildWithholding: RuleBuilder = ({ year, client }) => {
  if (client.isSemiannualWithholding) {
    return [
      {
        filingType: "withholding_semiannual",
        periodLabel: `${year}년 상반기`,
        baseDueDate: toISO(year, 7, 10),
      },
      {
        filingType: "withholding_semiannual",
        periodLabel: `${year}년 하반기`,
        baseDueDate: toISO(year + 1, 1, 10),
      },
    ];
  }
  return Array.from({ length: 12 }, (_, i) => {
    const month = i + 1; // 귀속 월
    const dueYear = month === 12 ? year + 1 : year;
    const dueMonth = month === 12 ? 1 : month + 1; // 익월 10일
    return {
      filingType: "withholding_monthly" as const,
      periodLabel: `${year}년 ${month}월분`,
      baseDueDate: toISO(dueYear, dueMonth, 10),
    };
  });
};

// --- 종합소득세 -------------------------------------------------------------
// 익년 5/31. 성실신고확인대상 6/30.
export const buildIncome: RuleBuilder = ({ year, client }) => [
  {
    filingType: "income",
    periodLabel: `${year}년 귀속`,
    baseDueDate: client.isDiligentFiling ? toISO(year + 1, 6, 30) : toISO(year + 1, 5, 31),
  },
];

// --- 법인세 -----------------------------------------------------------------
// 결산월 말일 + 3개월 말일. (12월 결산 → 익년 3/31)
export const buildCorporate: RuleBuilder = ({ year, client }) => [
  {
    filingType: "corporate",
    periodLabel: `${year} 사업연도(${client.closingMonth}월 결산)`,
    baseDueDate: endOfMonth(year, client.closingMonth + 3),
  },
];

// --- 지급명세서 / 간이지급명세서 (주요 기한) --------------------------------
// 지급명세서(근로·퇴직, 사업·기타): 익년 3/10.
// 간이지급명세서(근로): 상반기 7/31, 하반기 익년 1/31.
// TODO(payment-statement): 사업소득 간이지급명세서 매월(말일) 기한은 추후 추가.
export const buildPaymentStatements: RuleBuilder = ({ year }) => [
  {
    filingType: "payment_statement_wage",
    periodLabel: `${year}년 귀속`,
    baseDueDate: toISO(year + 1, 3, 10),
  },
  {
    filingType: "payment_statement_business",
    periodLabel: `${year}년 귀속`,
    baseDueDate: toISO(year + 1, 3, 10),
  },
  {
    filingType: "simple_payment_statement_wage",
    periodLabel: `${year}년 상반기`,
    baseDueDate: toISO(year, 7, 31),
  },
  {
    filingType: "simple_payment_statement_wage",
    periodLabel: `${year}년 하반기`,
    baseDueDate: toISO(year + 1, 1, 31),
  },
];
