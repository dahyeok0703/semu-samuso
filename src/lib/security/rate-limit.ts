/**
 * In-memory fixed-window rate limiter (pure, testable). Keyed by an arbitrary
 * string (e.g. "auth:<ip>" or "classify:<workspaceId>").
 *
 * ⚠️ Scope: this is per-process. On a single instance it is a real control; on
 * multi-instance/serverless it limits per instance. For strict global limits,
 * back this with Redis/Upstash (see docs/security-checklist.md) — the call
 * sites depend only on `rateLimit()`, so swapping the store is localized.
 */

type Bucket = { count: number; resetAt: number };

// Module-level store. Survives across requests within a warm instance.
const store = new Map<string, Bucket>();

export type RateLimitOptions = {
  /** Max requests allowed within the window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
};

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  /** Seconds until the window resets (for Retry-After). */
  retryAfterSec: number;
};

/** Returns whether the call is allowed and updates the counter. */
export function rateLimit(
  key: string,
  options: RateLimitOptions,
  now: number = Date.now(),
): RateLimitResult {
  const bucket = store.get(key);

  if (!bucket || bucket.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + options.windowMs });
    return { ok: true, remaining: options.limit - 1, retryAfterSec: 0 };
  }

  if (bucket.count >= options.limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }

  bucket.count += 1;
  return { ok: true, remaining: options.limit - bucket.count, retryAfterSec: 0 };
}

/** Test/maintenance helper: clear all counters. */
export function __resetRateLimits(): void {
  store.clear();
}

// Sensible default budgets per surface (override at call sites as needed).
export const RATE_LIMITS = {
  auth: { limit: 10, windowMs: 60_000 }, // login/signup/reset per IP
  upload: { limit: 60, windowMs: 60_000 }, // doc registration per workspace
  ai: { limit: 30, windowMs: 60_000 }, // /api/classify per workspace
  aiIp: { limit: 60, windowMs: 60_000 }, // /api/classify per IP
  webhook: { limit: 120, windowMs: 60_000 }, // per IP
} as const;
