/**
 * 신고 마감 자동 생성 엔진 (순수 함수, DB 비의존).
 *
 * generateFilingTasks(client, year) → 규칙 세트로 신고 task 들을 만들고,
 *   - 영업일 보정(주말/공휴일 → 다음 영업일)
 *   - 신고 유형별 기본 제출서류(expected_documents)
 * 를 채워 반환한다. 영속화/중복 skip 은 상위 server action 이 담당한다.
 *
 * ⚠️ 생성되는 마감일은 **일반 케이스 기준 예시**입니다. 세무사 검수 및
 *    개정세법 반영이 필요합니다(THIS IS A GENERAL-CASE TEMPLATE, NOT TAX ADVICE).
 */

import { adjustToBusinessDay, type HolidayPredicate } from "@/lib/filing-rules/business-days";
import { expectedDocsFor } from "@/lib/filing-rules/documents";
import { FILING_TYPES } from "@/lib/filing-rules/filing-types";
import { getHolidaySetForYears } from "@/lib/filing-rules/holidays";
import { selectRuleBuilders } from "@/lib/filing-rules/rule-map";
import type { ClientForRules, PlannedTask } from "@/lib/filing-rules/types";
import type { Client } from "@/types/database.types";

export const FILING_SCHEDULE_DISCLAIMER =
  "표시된 마감일은 일반 케이스 기준 예시입니다. 세무사 검수 및 개정세법 반영이 필요합니다.";

export type GenerateOptions = {
  /** Override the holiday source (mainly for tests). */
  holidays?: Set<string> | HolidayPredicate;
  /** Disable weekend/holiday adjustment (returns statutory dates). Default: true. */
  adjustBusinessDays?: boolean;
};

/** Map a DB client row to the rule-engine input shape. */
export function toClientForRules(client: Client): ClientForRules {
  return {
    taxType: client.tax_type,
    closingMonth: client.closing_month,
    isSemiannualWithholding: client.is_semiannual_withholding,
    isDiligentFiling: client.is_diligent_filing,
  };
}

/**
 * Generate the filing schedule for a client + 과세연도(year).
 * Returns [] when tax_type is unset (cannot determine obligations).
 */
export function generateFilingTasks(
  client: ClientForRules,
  year: number,
  options: GenerateOptions = {},
): PlannedTask[] {
  const builders = selectRuleBuilders(client.taxType);
  if (builders.length === 0) return [];

  const adjust = options.adjustBusinessDays ?? true;
  // Deadlines can roll into the following year, so cover both.
  const holidays = options.holidays ?? getHolidaySetForYears([year, year + 1]);

  const ctx = { year, client };
  const planned: PlannedTask[] = builders
    .flatMap((build) => build(ctx))
    .map((raw) => {
      const meta = FILING_TYPES[raw.filingType];
      const dueDate = adjust ? adjustToBusinessDay(raw.baseDueDate, holidays) : raw.baseDueDate;
      return {
        filingType: raw.filingType,
        category: meta.category,
        label: meta.label,
        periodLabel: raw.periodLabel,
        baseDueDate: raw.baseDueDate,
        dueDate,
        expectedDocuments: expectedDocsFor(meta.category),
      };
    });

  planned.sort((a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0));
  return planned;
}
