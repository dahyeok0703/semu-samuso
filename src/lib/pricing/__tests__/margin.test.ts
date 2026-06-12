import { describe, expect, it } from "vitest";

import { computeMargin } from "@/lib/pricing/margin";

describe("computeMargin", () => {
  it("matches the team reference scenario (~76% margin, not flagged)", () => {
    // team ₩49,500 + AI ₩10,000 + 메시지 0 + PG 3%
    const r = computeMargin({ mrrKrw: 49_500, aiCostKrw: 10_000, messageCostKrw: 0 });
    expect(r.pgFeeKrw).toBe(1485);
    expect(r.cogsKrw).toBe(11_485);
    expect(r.marginRate).toBeCloseTo(0.768, 2);
    expect(r.flagged).toBe(false);
    expect(r.meetsPriceGuard).toBe(true); // 49,500 ≥ 11,485 × 2
  });

  it("flags an account whose margin drops below target", () => {
    // Runaway AI cost on a small plan.
    const r = computeMargin({ mrrKrw: 9_900, aiCostKrw: 8_000, messageCostKrw: 500 });
    expect(r.marginRate! < 0.5).toBe(true);
    expect(r.flagged).toBe(true);
    expect(r.meetsPriceGuard).toBe(false);
  });

  it("counts overage as extra revenue", () => {
    const withoutOverage = computeMargin({ mrrKrw: 9_900, aiCostKrw: 6_000, messageCostKrw: 0 });
    const withOverage = computeMargin({
      mrrKrw: 9_900,
      extraRevenueKrw: 4_000,
      aiCostKrw: 6_000,
      messageCostKrw: 0,
    });
    expect(withOverage.revenueKrw).toBe(13_900);
    expect((withOverage.marginRate ?? 0) > (withoutOverage.marginRate ?? 0)).toBe(true);
  });

  it("does not flag trials/free (revenue 0 → margin null)", () => {
    const r = computeMargin({ mrrKrw: 0, aiCostKrw: 500, messageCostKrw: 0 });
    expect(r.marginRate).toBeNull();
    expect(r.flagged).toBe(false);
  });

  it("respects a custom target margin", () => {
    const r = computeMargin({ mrrKrw: 10_000, aiCostKrw: 3_500, messageCostKrw: 0 }, 0.8);
    // margin ≈ 0.62 < 0.8 → flagged at the stricter target
    expect(r.flagged).toBe(true);
  });
});
