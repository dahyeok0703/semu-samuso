import { beforeEach, describe, expect, it } from "vitest";

import { __resetRateLimits, rateLimit } from "@/lib/security/rate-limit";

describe("rateLimit", () => {
  beforeEach(() => __resetRateLimits());

  it("allows up to the limit then blocks", () => {
    const opts = { limit: 3, windowMs: 1000 };
    expect(rateLimit("k", opts, 0).ok).toBe(true);
    expect(rateLimit("k", opts, 0).ok).toBe(true);
    expect(rateLimit("k", opts, 0).ok).toBe(true);
    const blocked = rateLimit("k", opts, 0);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it("resets after the window elapses", () => {
    const opts = { limit: 1, windowMs: 1000 };
    expect(rateLimit("k", opts, 0).ok).toBe(true);
    expect(rateLimit("k", opts, 500).ok).toBe(false);
    expect(rateLimit("k", opts, 1000).ok).toBe(true); // window rolled over
  });

  it("tracks keys independently", () => {
    const opts = { limit: 1, windowMs: 1000 };
    expect(rateLimit("a", opts, 0).ok).toBe(true);
    expect(rateLimit("b", opts, 0).ok).toBe(true);
    expect(rateLimit("a", opts, 0).ok).toBe(false);
  });

  it("reports remaining budget", () => {
    const opts = { limit: 5, windowMs: 1000 };
    expect(rateLimit("k", opts, 0).remaining).toBe(4);
    expect(rateLimit("k", opts, 0).remaining).toBe(3);
  });
});
