import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import { newPaymentId, workspaceIdFromPaymentId } from "@/lib/billing/payment-id";
import {
  extractWebhookHeaders,
  verifyStandardWebhook,
  type WebhookHeaders,
} from "@/lib/billing/webhook";

const SECRET = "whsec_dGVzdHNlY3JldA=="; // base64("testsecret") with prefix
const NOW = new Date("2026-06-12T00:00:00Z");

function sign(id: string, timestamp: string, body: string): string {
  const raw = SECRET.slice("whsec_".length);
  const sig = createHmac("sha256", Buffer.from(raw, "base64"))
    .update(`${id}.${timestamp}.${body}`)
    .digest("base64");
  return `v1,${sig}`;
}

function headers(over: Partial<WebhookHeaders> = {}): WebhookHeaders {
  const id = "msg_1";
  const timestamp = String(Math.floor(NOW.getTime() / 1000));
  const body = '{"type":"Transaction.Paid"}';
  return {
    id,
    timestamp,
    signature: sign(id, timestamp, body),
    ...over,
  };
}

const BODY = '{"type":"Transaction.Paid"}';

describe("verifyStandardWebhook", () => {
  it("accepts a correctly signed payload", () => {
    expect(verifyStandardWebhook(SECRET, headers(), BODY, NOW)).toEqual({ ok: true });
  });

  it("rejects a tampered body", () => {
    const res = verifyStandardWebhook(SECRET, headers(), '{"type":"Transaction.Failed"}', NOW);
    expect(res.ok).toBe(false);
  });

  it("rejects a wrong signature", () => {
    const res = verifyStandardWebhook(SECRET, headers({ signature: "v1,deadbeef" }), BODY, NOW);
    expect(res.ok).toBe(false);
  });

  it("rejects missing headers", () => {
    const res = verifyStandardWebhook(SECRET, headers({ signature: null }), BODY, NOW);
    expect(res.ok).toBe(false);
  });

  it("rejects a stale timestamp (replay protection)", () => {
    const old = String(Math.floor(NOW.getTime() / 1000) - 3600);
    const res = verifyStandardWebhook(
      SECRET,
      { id: "msg_1", timestamp: old, signature: sign("msg_1", old, BODY) },
      BODY,
      NOW,
    );
    expect(res.ok).toBe(false);
  });

  it("accepts when one of several signatures matches (rotation)", () => {
    const h = headers();
    h.signature = `v1,invalidsig ${h.signature}`;
    expect(verifyStandardWebhook(SECRET, h, BODY, NOW)).toEqual({ ok: true });
  });
});

describe("extractWebhookHeaders", () => {
  it("reads Standard Webhooks headers case-insensitively", () => {
    const parsed = extractWebhookHeaders({
      "Webhook-Id": "msg_42",
      "WEBHOOK-TIMESTAMP": "123",
      "webhook-signature": "v1,abc",
    });
    expect(parsed).toEqual({ id: "msg_42", timestamp: "123", signature: "v1,abc" });
  });
});

describe("payment id <-> workspace mapping", () => {
  const ws = "0b6f1c4e-2d3a-4f5b-8c7d-9e0a1b2c3d4e";

  it("round-trips the workspace id", () => {
    const id = newPaymentId(ws, 1_700_000_000_000);
    expect(id).toBe(`pay_${ws}_1700000000000`);
    expect(workspaceIdFromPaymentId(id)).toBe(ws);
  });

  it("returns null for foreign / malformed ids", () => {
    expect(workspaceIdFromPaymentId(null)).toBeNull();
    expect(workspaceIdFromPaymentId("order_123")).toBeNull();
    expect(workspaceIdFromPaymentId("pay_not-a-uuid_123")).toBeNull();
  });
});
