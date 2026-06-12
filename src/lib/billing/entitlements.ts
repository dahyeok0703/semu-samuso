/**
 * Entitlement resolution — pure & client-safe. Given a workspace's stored
 * billing fields, compute the *effective* plan and its limits, accounting for
 * trial expiry and the post-failure grace period. This is the one place that
 * decides "what is this workspace allowed to do right now".
 *
 * Trial/grace policy (see CLAUDE.md & the billing migration):
 *   - trialing  : full access to the trial plan until trial_ends_at, then → free
 *   - past_due  : keep paid access until grace_until, then → free
 *   - canceled  : keep paid access until current_period_end, then → free
 *   - active    : the paid plan
 */

import { PLANS, planHasIntegration, type Integration, type PlanDef } from "@/lib/billing/plans";
import type { SubscriptionStatus, WorkspacePlan } from "@/types/database.types";

/** The subset of workspace fields needed to compute entitlements. */
export type BillingState = {
  plan: WorkspacePlan;
  subscription_status: SubscriptionStatus;
  trial_ends_at: string | null;
  current_period_end: string | null;
  grace_until: string | null;
};

export type Entitlements = {
  /** The plan actually in force right now (after trial/grace resolution). */
  effectivePlan: WorkspacePlan;
  /** The plan the workspace nominally signed up for. */
  nominalPlan: WorkspacePlan;
  limits: PlanDef;
  /** True while inside a still-valid free trial. */
  inTrial: boolean;
  /** Days left in trial (>= 0), or null when not trialing. */
  trialDaysLeft: number | null;
  /** True while a failed payment is within its grace window. */
  inGrace: boolean;
  /** Whether the paid access has lapsed and the workspace is effectively free. */
  downgraded: boolean;
};

function parse(ts: string | null): number | null {
  if (!ts) return null;
  const t = Date.parse(ts);
  return Number.isNaN(t) ? null : t;
}

function daysBetween(fromMs: number, toMs: number): number {
  return Math.ceil((toMs - fromMs) / 86_400_000);
}

/**
 * Resolve the effective entitlements for a workspace at time `now`.
 * Deterministic and side-effect free so it is trivially unit-testable.
 */
export function resolveEntitlements(state: BillingState, now: Date = new Date()): Entitlements {
  const nowMs = now.getTime();
  const nominalPlan = state.plan;
  const trialEnd = parse(state.trial_ends_at);
  const periodEnd = parse(state.current_period_end);
  const graceEnd = parse(state.grace_until);

  let effectivePlan: WorkspacePlan = nominalPlan;
  let inTrial = false;
  let trialDaysLeft: number | null = null;
  let inGrace = false;

  switch (state.subscription_status) {
    case "trialing": {
      if (trialEnd !== null && trialEnd > nowMs) {
        inTrial = true;
        trialDaysLeft = Math.max(0, daysBetween(nowMs, trialEnd));
      } else {
        effectivePlan = "free"; // trial expired → downgrade
      }
      break;
    }
    case "active": {
      effectivePlan = nominalPlan;
      break;
    }
    case "past_due": {
      // Keep paid access until the grace window closes.
      effectivePlan = graceEnd !== null && graceEnd > nowMs ? nominalPlan : "free";
      inGrace = graceEnd !== null && graceEnd > nowMs;
      break;
    }
    case "canceled": {
      // Access continues until the period ends, then drops to free.
      effectivePlan = periodEnd !== null && periodEnd > nowMs ? nominalPlan : "free";
      break;
    }
    case "none":
    default: {
      // No subscription: honor whatever plan is stored (normally free).
      effectivePlan = nominalPlan;
      break;
    }
  }

  return {
    effectivePlan,
    nominalPlan,
    limits: PLANS[effectivePlan],
    inTrial,
    trialDaysLeft,
    inGrace,
    downgraded: effectivePlan !== nominalPlan && effectivePlan === "free",
  };
}

// ---------------------------------------------------------------------------
// Limit checks (pure). Counts are passed in by the caller (server-side query).
// ---------------------------------------------------------------------------

export type LimitCheck = { allowed: boolean; limit: number | null; reason?: string };

export function checkClientLimit(ent: Entitlements, currentClients: number): LimitCheck {
  const limit = ent.limits.maxClients;
  if (limit === null) return { allowed: true, limit: null };
  if (currentClients < limit) return { allowed: true, limit };
  return {
    allowed: false,
    limit,
    reason: `현재 플랜(${ent.limits.name})은 거래처 ${limit}건까지 등록할 수 있습니다. 상위 플랜으로 업그레이드해 주세요.`,
  };
}

/** `addingSeats` defaults to checking whether one more seat fits. */
export function checkSeatLimit(
  ent: Entitlements,
  currentSeats: number,
  addingSeats = 1,
): LimitCheck {
  const limit = ent.limits.maxSeats;
  if (limit === null) return { allowed: true, limit: null };
  if (currentSeats + addingSeats <= limit) return { allowed: true, limit };
  return {
    allowed: false,
    limit,
    reason: `현재 플랜(${ent.limits.name})은 직원 ${limit}인까지 가능합니다. 직원을 추가하려면 Team 이상으로 업그레이드해 주세요.`,
  };
}

export function checkIntegration(ent: Entitlements, integration: Integration): LimitCheck {
  const allowed = planHasIntegration(ent.effectivePlan, integration);
  return {
    allowed,
    limit: null,
    reason: allowed
      ? undefined
      : `${integration === "kakao" ? "카카오 알림톡" : "코드에프 연동"}은 Pro 플랜에서 사용할 수 있습니다.`,
  };
}
