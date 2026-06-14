import "server-only";

import { headers } from "next/headers";

import { env } from "@/lib/env";
import { rateLimit, type RateLimitOptions, type RateLimitResult } from "@/lib/security/rate-limit";

/** Best-effort client IP from proxy headers. Falls back to "unknown". */
export function clientIpFrom(h: Headers): string {
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return h.get("x-real-ip") ?? h.get("cf-connecting-ip") ?? "unknown";
}

/** Client IP within a server action (reads the request headers). */
export async function clientIp(): Promise<string> {
  return clientIpFrom(await headers());
}

/**
 * Rate-limit gate that honors the global disable flag. Returns the result so
 * callers can throw/respond appropriately.
 */
export function guard(key: string, options: RateLimitOptions): RateLimitResult {
  if (env.RATE_LIMIT_DISABLED) return { ok: true, remaining: options.limit, retryAfterSec: 0 };
  return rateLimit(key, options);
}
