import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import { env, features } from "@/lib/env";
import { aiCallCostKrw } from "@/lib/pricing/cogs";

/** Models (user-specified): Haiku 4.5 primary, Sonnet 4.6 fallback on low confidence / parse failure. */
export const PRIMARY_MODEL = "claude-haiku-4-5";
export const FALLBACK_MODEL = "claude-sonnet-4-6";

let cached: Anthropic | null = null;

/**
 * Returns the Anthropic client, or null when ANTHROPIC_API_KEY is unset
 * (auto-classification disabled → manual mode). The SDK retries 429/5xx with
 * exponential backoff automatically (maxRetries).
 */
export function getAnthropic(): Anthropic | null {
  if (!features.aiClassification || !env.ANTHROPIC_API_KEY) return null;
  if (!cached) {
    cached = new Anthropic({
      apiKey: env.ANTHROPIC_API_KEY,
      maxRetries: 3,
      timeout: 60_000,
    });
  }
  return cached;
}

/**
 * Estimated cost in KRW for a single call's token usage. Delegates to the
 * single source of truth (lib/pricing/cogs.ts) so pricing/FX changes are
 * configured in one place. `batch` applies the Batch API 50% discount.
 */
export function estimateCostKrw(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cacheReadTokens: number,
  batch = false,
): number {
  return aiCallCostKrw({ model, inputTokens, outputTokens, cacheReadTokens, batch });
}
