import { describe, expect, it } from "vitest";

import {
  aiCallCostKrw,
  includedDocs,
  marginRate,
  messageCostKrw,
  OVERAGE_MULTIPLIER,
  overageUnitPriceKrw,
  pgFeeKrw,
  PLAN_DOC_QUOTA,
  quotaPolicy,
  quotaStatusFor,
  DOC_REFERENCE_COST_KRW,
} from "@/lib/pricing/cogs";

describe("aiCallCostKrw", () => {
  it("prices Haiku input/output at the configured USD×FX", () => {
    // 1000 in, 500 out @ haiku ($1/$5 per MTok) × 1400 KRW
    // = (0.001 + 0.0025) × 1400 = 4.9
    expect(aiCallCostKrw({ model: "claude-haiku-4-5", inputTokens: 1000, outputTokens: 500 })).toBe(
      4.9,
    );
  });

  it("charges cache-read tokens at 10% of input", () => {
    const base = aiCallCostKrw({ model: "claude-haiku-4-5", inputTokens: 1000, outputTokens: 500 });
    const withCache = aiCallCostKrw({
      model: "claude-haiku-4-5",
      inputTokens: 1000,
      outputTokens: 500,
      cacheReadTokens: 10_000,
    });
    // 10000 × $1/MTok × 0.1 × 1400 = 1.4
    expect(withCache - base).toBeCloseTo(1.4, 5);
  });

  it("applies the 50% batch discount", () => {
    const sync = aiCallCostKrw({
      model: "claude-haiku-4-5",
      inputTokens: 4000,
      outputTokens: 2000,
    });
    const batch = aiCallCostKrw({
      model: "claude-haiku-4-5",
      inputTokens: 4000,
      outputTokens: 2000,
      batch: true,
    });
    expect(batch).toBeCloseTo(sync / 2, 5);
  });

  it("prices Sonnet higher than Haiku", () => {
    const haiku = aiCallCostKrw({
      model: "claude-haiku-4-5",
      inputTokens: 1000,
      outputTokens: 1000,
    });
    const sonnet = aiCallCostKrw({
      model: "claude-sonnet-4-6",
      inputTokens: 1000,
      outputTokens: 1000,
    });
    expect(sonnet).toBeGreaterThan(haiku);
  });
});

describe("message / PG cost", () => {
  it("uses per-channel message unit costs", () => {
    expect(messageCostKrw("kakao", 10)).toBe(80);
    expect(messageCostKrw("sms", 3)).toBe(60);
    expect(messageCostKrw("inapp", 100)).toBe(0);
  });

  it("computes the PG fee as 3% of revenue", () => {
    expect(pgFeeKrw(50_000)).toBe(1500);
  });
});

describe("quota", () => {
  it("scales team quota with seats, free is flat", () => {
    expect(includedDocs("free", 1)).toBe(PLAN_DOC_QUOTA.free.base);
    expect(includedDocs("team", 5)).toBe(PLAN_DOC_QUOTA.team.perSeat * 5);
    expect(includedDocs("pro", 1)).toBe(PLAN_DOC_QUOTA.pro.base);
  });

  it("resolves policy: plan default unless overridden", () => {
    expect(quotaPolicy("free", null)).toBe("hardcap");
    expect(quotaPolicy("team", null)).toBe("overage");
    expect(quotaPolicy("free", "overage")).toBe("overage"); // override wins
  });

  it("decides ok / blocked / overage at the boundary", () => {
    expect(quotaStatusFor(9, 10, "hardcap")).toBe("ok");
    expect(quotaStatusFor(10, 10, "hardcap")).toBe("blocked");
    expect(quotaStatusFor(10, 10, "overage")).toBe("overage");
  });

  it("prices overage at cost × multiplier", () => {
    expect(overageUnitPriceKrw()).toBe(Math.ceil(DOC_REFERENCE_COST_KRW * OVERAGE_MULTIPLIER));
  });
});

describe("marginRate", () => {
  it("returns (revenue − cogs) / revenue, null when revenue is 0", () => {
    expect(marginRate(100, 40)).toBe(0.6);
    expect(marginRate(0, 40)).toBeNull();
  });
});
