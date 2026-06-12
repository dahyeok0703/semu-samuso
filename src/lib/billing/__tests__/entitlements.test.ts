import { describe, expect, it } from "vitest";

import {
  checkClientLimit,
  checkIntegration,
  checkSeatLimit,
  resolveEntitlements,
  type BillingState,
} from "@/lib/billing/entitlements";
import { monthlyAmount, PLANS } from "@/lib/billing/plans";

const NOW = new Date("2026-06-12T00:00:00Z");

function state(overrides: Partial<BillingState>): BillingState {
  return {
    plan: "free",
    subscription_status: "none",
    trial_ends_at: null,
    current_period_end: null,
    grace_until: null,
    ...overrides,
  };
}

describe("resolveEntitlements", () => {
  it("free workspace stays on free", () => {
    const ent = resolveEntitlements(state({ plan: "free" }), NOW);
    expect(ent.effectivePlan).toBe("free");
    expect(ent.limits.maxClients).toBe(10);
  });

  it("active subscription grants the paid plan", () => {
    const ent = resolveEntitlements(state({ plan: "team", subscription_status: "active" }), NOW);
    expect(ent.effectivePlan).toBe("team");
    expect(ent.limits.maxClients).toBeNull();
  });

  it("valid trial keeps the plan and reports days left", () => {
    const ent = resolveEntitlements(
      state({
        plan: "pro",
        subscription_status: "trialing",
        trial_ends_at: "2026-06-20T00:00:00Z",
      }),
      NOW,
    );
    expect(ent.effectivePlan).toBe("pro");
    expect(ent.inTrial).toBe(true);
    expect(ent.trialDaysLeft).toBe(8);
  });

  it("expired trial downgrades to free", () => {
    const ent = resolveEntitlements(
      state({
        plan: "pro",
        subscription_status: "trialing",
        trial_ends_at: "2026-06-01T00:00:00Z",
      }),
      NOW,
    );
    expect(ent.effectivePlan).toBe("free");
    expect(ent.downgraded).toBe(true);
  });

  it("past_due keeps access during grace, downgrades after", () => {
    const inGrace = resolveEntitlements(
      state({
        plan: "team",
        subscription_status: "past_due",
        grace_until: "2026-06-14T00:00:00Z",
      }),
      NOW,
    );
    expect(inGrace.effectivePlan).toBe("team");
    expect(inGrace.inGrace).toBe(true);

    const afterGrace = resolveEntitlements(
      state({
        plan: "team",
        subscription_status: "past_due",
        grace_until: "2026-06-10T00:00:00Z",
      }),
      NOW,
    );
    expect(afterGrace.effectivePlan).toBe("free");
    expect(afterGrace.inGrace).toBe(false);
  });

  it("canceled keeps access until period end", () => {
    const before = resolveEntitlements(
      state({
        plan: "pro",
        subscription_status: "canceled",
        current_period_end: "2026-06-30T00:00:00Z",
      }),
      NOW,
    );
    expect(before.effectivePlan).toBe("pro");

    const after = resolveEntitlements(
      state({
        plan: "pro",
        subscription_status: "canceled",
        current_period_end: "2026-06-01T00:00:00Z",
      }),
      NOW,
    );
    expect(after.effectivePlan).toBe("free");
  });
});

describe("limit checks", () => {
  const freeEnt = resolveEntitlements(state({ plan: "free" }), NOW);
  const teamEnt = resolveEntitlements(state({ plan: "team", subscription_status: "active" }), NOW);

  it("blocks the 11th client on free, allows under the cap", () => {
    expect(checkClientLimit(freeEnt, 9).allowed).toBe(true);
    expect(checkClientLimit(freeEnt, 10).allowed).toBe(false);
    expect(checkClientLimit(teamEnt, 9999).allowed).toBe(true);
  });

  it("blocks a 2nd seat on free", () => {
    expect(checkSeatLimit(freeEnt, 1, 1).allowed).toBe(false);
    expect(checkSeatLimit(teamEnt, 50, 1).allowed).toBe(true);
  });

  it("gates kakao/codef to pro", () => {
    expect(checkIntegration(teamEnt, "kakao").allowed).toBe(false);
    const proEnt = resolveEntitlements(state({ plan: "pro", subscription_status: "active" }), NOW);
    expect(checkIntegration(proEnt, "kakao").allowed).toBe(true);
    expect(checkIntegration(proEnt, "codef").allowed).toBe(true);
  });
});

describe("monthlyAmount", () => {
  it("scales team per seat, flat for pro", () => {
    expect(monthlyAmount("free", 1)).toBe(0);
    expect(monthlyAmount("team", 3)).toBe(PLANS.team.monthlyPrice * 3);
    expect(monthlyAmount("pro", 10)).toBe(PLANS.pro.monthlyPrice);
  });
});
