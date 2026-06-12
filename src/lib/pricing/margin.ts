/**
 * 워크스페이스 단위 마진 계산 (pure). MRR(구독료) 대비 COGS(AI + 메시지 + PG수수료)를
 * 합산해 마진율을 구하고, 목표치 미만이면 플래그한다. 모든 단가는 cogs.ts 설정값.
 */

import { marginRate, pgFeeKrw, TARGET_MARGIN } from "@/lib/pricing/cogs";

export type MarginInput = {
  /** 월 구독료(₩, VAT 별도) — 변동비 가드의 분자. */
  mrrKrw: number;
  /** 오버리지 등 추가 매출(₩). */
  extraRevenueKrw?: number;
  /** 이번 달 AI 분류 원가(₩). */
  aiCostKrw: number;
  /** 이번 달 메시지(알림톡/SMS) 원가(₩). */
  messageCostKrw: number;
};

export type MarginResult = {
  revenueKrw: number;
  aiCostKrw: number;
  messageCostKrw: number;
  pgFeeKrw: number;
  cogsKrw: number;
  /** 0~1, 매출 0이면 null. */
  marginRate: number | null;
  /** 목표 마진 미만 여부(매출 0/COGS 0 제외). */
  flagged: boolean;
  /** 변동비 × 2 가드 충족 여부. */
  meetsPriceGuard: boolean;
};

export function computeMargin(input: MarginInput, target = TARGET_MARGIN): MarginResult {
  const revenue = input.mrrKrw + (input.extraRevenueKrw ?? 0);
  const pg = pgFeeKrw(revenue);
  const variableCost = input.aiCostKrw + input.messageCostKrw + pg;
  const rate = marginRate(revenue, variableCost);

  return {
    revenueKrw: revenue,
    aiCostKrw: input.aiCostKrw,
    messageCostKrw: input.messageCostKrw,
    pgFeeKrw: pg,
    cogsKrw: variableCost,
    marginRate: rate,
    // 매출이 있고 변동비가 발생했는데 목표 미만이면 플래그.
    flagged: rate !== null && variableCost > 0 && rate < target,
    meetsPriceGuard: variableCost === 0 ? true : revenue >= variableCost * 2,
  };
}
