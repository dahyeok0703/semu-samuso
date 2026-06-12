/**
 * Plan catalogue — the single source of truth for pricing, limits and feature
 * entitlements. Pure & client-safe (no server-only imports) so both the public
 * /pricing page and the in-app gating logic share the same numbers.
 *
 * 가격은 부가세(VAT) 별도 기준 월정액(원)입니다. 표시 시 안내 문구로 명시합니다.
 */

import type { WorkspacePlan } from "@/types/database.types";

/** Optional integrations that a plan may unlock. */
export type Integration = "kakao" | "codef";

export type PlanDef = {
  id: WorkspacePlan;
  name: string;
  /** One-line positioning shown on the pricing cards. */
  tagline: string;
  /**
   * Monthly price in KRW (VAT 별도).
   *   - free: 0
   *   - team: per-seat (직원 시트당) — multiply by seat count
   *   - pro:  flat
   */
  monthlyPrice: number;
  /** team bills per seat; free/pro bill a flat amount. */
  perSeat: boolean;
  /** Max billable seats (직원 수, owner 포함). null = unlimited. */
  maxSeats: number | null;
  /** Max active clients (거래처 수). null = unlimited. */
  maxClients: number | null;
  /** Integrations enabled on this plan. */
  integrations: Integration[];
  /** Bullet points for the pricing card. */
  features: string[];
};

/** Free-trial length, in days. */
export const TRIAL_DAYS = 14;

export const PLANS: Record<WorkspacePlan, PlanDef> = {
  free: {
    id: "free",
    name: "Free",
    tagline: "1인 사무소를 위한 무료 시작",
    monthlyPrice: 0,
    perSeat: false,
    maxSeats: 1,
    maxClients: 10,
    integrations: [],
    features: ["직원 1인", "거래처 10건까지", "신고 일정 자동 생성", "이메일·인앱 독촉"],
  },
  team: {
    id: "team",
    name: "Team",
    tagline: "직원이 함께 쓰는 표준 플랜",
    monthlyPrice: 9_900,
    perSeat: true,
    maxSeats: null,
    maxClients: null,
    integrations: [],
    features: [
      "직원 시트당 월 9,900원",
      "거래처 무제한",
      "담당 배정·권한 관리",
      "AI 자동 분류·감사 로그",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    tagline: "연동까지 모두 켜는 프리미엄",
    monthlyPrice: 99_000,
    perSeat: false,
    maxSeats: null,
    maxClients: null,
    integrations: ["kakao", "codef"],
    features: [
      "Team의 모든 기능",
      "직원·거래처 무제한",
      "카카오 알림톡 발송",
      "코드에프(CODEF) 스크래핑 연동",
    ],
  },
};

export const PLAN_ORDER: WorkspacePlan[] = ["free", "team", "pro"];

export function planDef(plan: WorkspacePlan): PlanDef {
  return PLANS[plan];
}

/** Korean label for a plan id. */
export function planLabel(plan: WorkspacePlan): string {
  return PLANS[plan].name;
}

/**
 * Monthly charge (KRW, VAT 별도) for a plan at a given seat count.
 * team scales with seats; free/pro are flat.
 */
export function monthlyAmount(plan: WorkspacePlan, seats: number): number {
  const def = PLANS[plan];
  if (!def.perSeat) return def.monthlyPrice;
  return def.monthlyPrice * Math.max(1, seats);
}

/** Whether `plan` unlocks the given optional integration. */
export function planHasIntegration(plan: WorkspacePlan, integration: Integration): boolean {
  return PLANS[plan].integrations.includes(integration);
}

export const KRW = new Intl.NumberFormat("ko-KR");

/** "9,900원" / "무료" */
export function formatKrw(amount: number): string {
  return amount === 0 ? "무료" : `${KRW.format(amount)}원`;
}
