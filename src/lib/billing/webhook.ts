import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Standard Webhooks signature verification (https://www.standardwebhooks.com),
 * which PortOne v2 implements. The signed content is:
 *
 *     `${webhook-id}.${webhook-timestamp}.${body}`
 *
 * signed with HMAC-SHA256 using the secret (base64, optionally `whsec_`-prefixed)
 * and base64-encoded. The `webhook-signature` header may carry multiple
 * space-separated `v1,<sig>` entries (for key rotation) — any match passes.
 *
 * Kept dependency-free and side-effect free so it is unit-testable without the
 * provider SDK.
 */

const TOLERANCE_SECONDS = 5 * 60; // reject stale deliveries (replay protection)

export type WebhookHeaders = {
  id: string | null;
  timestamp: string | null;
  signature: string | null;
};

/** Pull the Standard Webhooks headers (case-insensitive) from a header bag. */
export function extractWebhookHeaders(headers: Record<string, string>): WebhookHeaders {
  const get = (name: string): string | null => {
    const lower = name.toLowerCase();
    for (const [k, v] of Object.entries(headers)) {
      if (k.toLowerCase() === lower) return v;
    }
    return null;
  };
  return {
    id: get("webhook-id"),
    timestamp: get("webhook-timestamp"),
    signature: get("webhook-signature"),
  };
}

function decodeSecret(secret: string): Buffer {
  const raw = secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret;
  // Standard Webhooks secrets are base64; fall back to utf8 if not valid base64.
  try {
    return Buffer.from(raw, "base64");
  } catch {
    return Buffer.from(raw, "utf8");
  }
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export type VerifyOutcome = { ok: true } | { ok: false; reason: string };

/**
 * Verify a Standard Webhooks signature. `now` is injectable for tests.
 */
export function verifyStandardWebhook(
  secret: string,
  headers: WebhookHeaders,
  body: string,
  now: Date = new Date(),
): VerifyOutcome {
  const { id, timestamp, signature } = headers;
  if (!id || !timestamp || !signature) {
    return { ok: false, reason: "missing webhook signature headers" };
  }

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return { ok: false, reason: "invalid timestamp" };
  const skew = Math.abs(Math.floor(now.getTime() / 1000) - ts);
  if (skew > TOLERANCE_SECONDS) return { ok: false, reason: "timestamp outside tolerance" };

  const signedContent = `${id}.${timestamp}.${body}`;
  const expected = createHmac("sha256", decodeSecret(secret))
    .update(signedContent)
    .digest("base64");

  // The header is a space-separated list of `version,signature` pairs.
  const candidates = signature
    .split(" ")
    .map((part) => {
      const comma = part.indexOf(",");
      return comma === -1 ? part : part.slice(comma + 1);
    })
    .filter(Boolean);

  for (const candidate of candidates) {
    if (safeEqual(candidate, expected)) return { ok: true };
  }
  return { ok: false, reason: "no matching signature" };
}
