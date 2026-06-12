/**
 * COGS / 마진 보호 설정 — 단일 소스 오브 트루스 (pure, client-safe).
 *
 * 가격 정책·단가·환율·목표마진·쿼터를 코드 수정 없이 여기서만 조정하면 됩니다.
 * 변동비의 위험 레버는 '문서 수' 하나뿐이므로 쿼터 + 오버리지로 통제합니다.
 *
 * 마진 모델: 가격 ≥ 변동비 × 2  (목표 마진 50%).
 *   예) team ₩9,900/석 × 5석 = ₩49,500 + 문서 2,000건 포함
 *       → AI원가 ~₩10,000(20%) + PG ~₩1,500(3%) → 마진 ~76%.
 */

import type { WorkspacePlan } from "@/types/database.types";

// ---------------------------------------------------------------------------
// 환율 / 결제·메시지 단가
// ---------------------------------------------------------------------------

/** USD→KRW 환산 가정. 환율이 바뀌면 이 값만 조정. */
export const USD_TO_KRW = 1_400;

/** 모델별 USD per 1M tokens (Anthropic 공시가). cache read ≈ 0.1× input. */
export const MODEL_PRICING_USD: Record<string, { input: number; output: number }> = {
  "claude-haiku-4-5": { input: 1.0, output: 5.0 },
  "claude-sonnet-4-6": { input: 3.0, output: 15.0 },
};

/** prompt caching: 캐시 read 토큰은 input 단가의 10%만 청구. */
export const CACHE_READ_DISCOUNT = 0.1;

/** Batch API 할인 (급하지 않은 분류 50% 절감). */
export const BATCH_DISCOUNT = 0.5;

/** PG(포트원/토스) 결제 수수료율. */
export const PG_FEE_RATE = 0.03;

/** 메시지 채널 건당 원가(₩). 알림톡/SMS는 발송사 단가 기준. */
export const MESSAGE_COST_KRW: Record<"kakao" | "sms" | "email" | "inapp", number> = {
  kakao: 8, // 알림톡
  sms: 20,
  email: 1, // SMTP 변동비 미미
  inapp: 0,
};

/** 문서 1장 평균 AI 원가 참고치(₩). 오버리지 단가/쿼터 경제성 계산 기준. */
export const DOC_REFERENCE_COST_KRW = 5;

// ---------------------------------------------------------------------------
// 마진 목표
// ---------------------------------------------------------------------------

/** 목표 마진율(기본 50%). 이 아래로 떨어지는 워크스페이스는 자동 플래그. */
export const TARGET_MARGIN = 0.5;

/** 가격 정책 가드: 가격 ≥ 변동비 × 이 배수. */
export const PRICE_TO_VARIABLE_COST_MIN_RATIO = 2;

// ---------------------------------------------------------------------------
// 플랜별 포함 문서 쿼터 + 초과 정책
// ---------------------------------------------------------------------------

export type QuotaPolicy = "hardcap" | "overage";

/**
 * 포함 문서 수 = base + perSeat × 시트수.
 * team은 시트당 과금이므로 쿼터도 시트에 비례시켜 마진을 유지한다.
 */
export const PLAN_DOC_QUOTA: Record<WorkspacePlan, { base: number; perSeat: number }> = {
  free: { base: 30, perSeat: 0 },
  team: { base: 0, perSeat: 400 }, // 5석 → 2,000건
  pro: { base: 10_000, perSeat: 0 },
};

/** 플랜별 쿼터 초과 시 기본 동작. 워크스페이스 설정으로 override 가능. */
export const DEFAULT_QUOTA_POLICY: Record<WorkspacePlan, QuotaPolicy> = {
  free: "hardcap", // 무료는 하드캡 → 수동 모드 전환
  team: "overage",
  pro: "overage",
};

/** 오버리지 단가 배수 (원가 × 배수로 자동 과금해 마진 보존). */
export const OVERAGE_MULTIPLIER = 2;

// ---------------------------------------------------------------------------
// 계산 헬퍼 (모두 순수 함수)
// ---------------------------------------------------------------------------

/** 단일 호출의 AI 원가(₩). batch=true면 50% 할인 적용. */
export function aiCallCostKrw(args: {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  batch?: boolean;
}): number {
  const price = MODEL_PRICING_USD[args.model] ?? MODEL_PRICING_USD["claude-haiku-4-5"]!;
  const usd =
    (args.inputTokens / 1_000_000) * price.input +
    ((args.cacheReadTokens ?? 0) / 1_000_000) * price.input * CACHE_READ_DISCOUNT +
    (args.outputTokens / 1_000_000) * price.output;
  const discounted = args.batch ? usd * BATCH_DISCOUNT : usd;
  return round2(discounted * USD_TO_KRW);
}

/** 메시지 발송 원가(₩). */
export function messageCostKrw(channel: keyof typeof MESSAGE_COST_KRW, count: number): number {
  return round2((MESSAGE_COST_KRW[channel] ?? 0) * Math.max(0, count));
}

/** PG 결제 수수료(₩). */
export function pgFeeKrw(revenueKrw: number): number {
  return round2(revenueKrw * PG_FEE_RATE);
}

/** 포함 문서 쿼터. */
export function includedDocs(plan: WorkspacePlan, seats: number): number {
  const q = PLAN_DOC_QUOTA[plan];
  return q.base + q.perSeat * Math.max(1, seats);
}

/** 워크스페이스에 적용할 쿼터 정책(설정 override > 플랜 기본). */
export function quotaPolicy(plan: WorkspacePlan, override: QuotaPolicy | null): QuotaPolicy {
  return override ?? DEFAULT_QUOTA_POLICY[plan];
}

/** 오버리지 문서 1건당 청구액(₩) = 원가 × 배수. */
export function overageUnitPriceKrw(): number {
  return Math.ceil(DOC_REFERENCE_COST_KRW * OVERAGE_MULTIPLIER);
}

/** 다음 1건 분류 시 쿼터 판정 (pure). used = 이번 달 이미 분류한 건수. */
export function quotaStatusFor(
  used: number,
  included: number,
  policy: QuotaPolicy,
): "ok" | "overage" | "blocked" {
  if (used < included) return "ok";
  return policy === "hardcap" ? "blocked" : "overage";
}

/** 마진율 = (매출 − COGS) / 매출. 매출 0이면 null. */
export function marginRate(revenueKrw: number, cogsKrw: number): number | null {
  if (revenueKrw <= 0) return null;
  return round4((revenueKrw - cogsKrw) / revenueKrw);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}
