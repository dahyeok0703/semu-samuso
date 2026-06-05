import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import { env, features } from "@/lib/env";

/** Models (user-specified): Haiku 4.5 primary, Sonnet 4.6 fallback on low confidence / parse failure. */
export const PRIMARY_MODEL = "claude-haiku-4-5";
export const FALLBACK_MODEL = "claude-sonnet-4-6";

/** USD→KRW assumption for cost estimation (ai_usage). Adjust as needed. */
export const USD_TO_KRW = 1400;

/** Per-1M-token USD pricing (skill catalog). cache reads ≈ 0.1× input. */
export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "claude-haiku-4-5": { input: 1.0, output: 5.0 },
  "claude-sonnet-4-6": { input: 3.0, output: 15.0 },
};

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

/** Estimated cost in KRW for a single call's token usage. */
export function estimateCostKrw(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cacheReadTokens: number,
): number {
  const price = MODEL_PRICING[model] ?? MODEL_PRICING[PRIMARY_MODEL]!;
  const usd =
    (inputTokens / 1_000_000) * price.input +
    (cacheReadTokens / 1_000_000) * price.input * 0.1 +
    (outputTokens / 1_000_000) * price.output;
  return Math.round(usd * USD_TO_KRW * 100) / 100;
}
