import "server-only";

import { entitlementsFor } from "@/lib/billing/gating";
import {
  includedDocs,
  overageUnitPriceKrw,
  quotaPolicy,
  quotaStatusFor,
  type QuotaPolicy,
} from "@/lib/pricing/cogs";
import type { Workspace } from "@/types/database.types";

/**
 * 문서 분류 쿼터 판정 (마진 보호의 핵심). 효과적 플랜(체험/그레이스 반영) + 시트수로
 * 포함 쿼터를 구하고, 초과 시 워크스페이스 정책(하드캡/오버리지)으로 동작을 정한다.
 */

export type QuotaStatus = "ok" | "overage" | "blocked";

export type QuotaDecision = {
  status: QuotaStatus;
  plan: Workspace["plan"];
  policy: QuotaPolicy;
  includedDocs: number;
  used: number;
  remaining: number; // max(0, included - used)
  /** 오버리지로 청구될 경우 문서 1건당 금액(₩). */
  overageUnitPriceKrw: number;
};

/**
 * `used` = 이번 달 이미 분류된 문서 수. 다음 1건을 분류할 때의 판정을 돌려준다.
 */
export function decideDocQuota(workspace: Workspace, used: number): QuotaDecision {
  const ent = entitlementsFor(workspace);
  const plan = ent.effectivePlan;
  const seats = workspace.billing_seats;
  const included = includedDocs(plan, seats);
  const policy = quotaPolicy(plan, workspace.ai_quota_policy);
  const remaining = Math.max(0, included - used);
  const status = quotaStatusFor(used, included, policy);

  return {
    status,
    plan,
    policy,
    includedDocs: included,
    used,
    remaining,
    overageUnitPriceKrw: overageUnitPriceKrw(),
  };
}

/** 대시보드 게이지용 사용량 요약. */
export type QuotaUsage = {
  plan: Workspace["plan"];
  includedDocs: number;
  used: number;
  remaining: number;
  /** 0~1+ (오버리지면 1 초과 가능). */
  ratio: number;
  policy: QuotaPolicy;
};

export function summarizeQuota(workspace: Workspace, used: number): QuotaUsage {
  const d = decideDocQuota(workspace, used);
  return {
    plan: d.plan,
    includedDocs: d.includedDocs,
    used,
    remaining: d.remaining,
    ratio: d.includedDocs > 0 ? used / d.includedDocs : used > 0 ? 1 : 0,
    policy: d.policy,
  };
}
