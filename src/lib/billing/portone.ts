import "server-only";

import { env } from "@/lib/env";
import { extractWebhookHeaders, verifyStandardWebhook } from "@/lib/billing/webhook";
import type {
  ChargeInput,
  ChargeResult,
  PaymentLookup,
  PaymentProvider,
  ScheduleInput,
  ScheduleResult,
  WebhookVerifyResult,
} from "@/lib/billing/provider";

/**
 * PortOne v2 adapter. REST against https://api.portone.io using the V2 API
 * secret (`Authorization: PortOne <secret>`). Billing keys are issued on the
 * browser via the PortOne SDK (TossPayments channel); the server then charges
 * and schedules against the returned key.
 *
 * Docs: https://developers.portone.io/api/rest-v2
 */

const API_BASE = "https://api.portone.io";

function authHeaders(): Record<string, string> {
  return {
    Authorization: `PortOne ${env.PORTONE_API_SECRET}`,
    "Content-Type": "application/json",
  };
}

async function fetchJson(
  path: string,
  init: RequestInit,
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const res = await fetch(`${API_BASE}${path}`, init);
  let body: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  return { ok: res.ok, status: res.status, body };
}

function normalizeStatus(raw: string | undefined): PaymentLookup["status"] {
  switch ((raw ?? "").toUpperCase()) {
    case "PAID":
      return "paid";
    case "FAILED":
      return "failed";
    case "CANCELLED":
    case "CANCELED":
      return "canceled";
    case "READY":
    case "PENDING":
    case "VIRTUAL_ACCOUNT_ISSUED":
      return "pending";
    default:
      return "unknown";
  }
}

function pick<T = unknown>(obj: unknown, ...keys: string[]): T | undefined {
  let cur: unknown = obj;
  for (const k of keys) {
    if (cur && typeof cur === "object" && k in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[k];
    } else {
      return undefined;
    }
  }
  return cur as T;
}

export class PortOneProvider implements PaymentProvider {
  readonly name = "portone";

  async charge(input: ChargeInput): Promise<ChargeResult> {
    // Instant billing-key payment.
    const { ok, body } = await fetchJson(
      `/payments/${encodeURIComponent(input.paymentId)}/billing-key`,
      {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          billingKey: input.billingKey,
          orderName: input.orderName,
          customer: {
            id: input.customer.customerKey,
            name: input.customer.name ? { full: input.customer.name } : undefined,
            email: input.customer.email ?? undefined,
          },
          amount: { total: input.amount },
          currency: "KRW",
        }),
      },
    );

    const failureReason = pick<string>(body, "message") ?? pick<string>(body, "type") ?? null;

    if (!ok) {
      return {
        ok: false,
        paymentId: input.paymentId,
        status: "failed",
        failureReason,
        raw: body,
      };
    }

    return {
      ok: true,
      paymentId: input.paymentId,
      status: "paid",
      receiptUrl: pick<string>(body, "payment", "receiptUrl") ?? null,
      raw: body,
    };
  }

  async schedule(input: ScheduleInput): Promise<ScheduleResult> {
    const { ok, body } = await fetchJson(
      `/payments/${encodeURIComponent(input.paymentId)}/schedule`,
      {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          payment: {
            billingKey: input.billingKey,
            orderName: input.orderName,
            customer: { id: input.customer.customerKey },
            amount: { total: input.amount },
            currency: "KRW",
          },
          timeToPay: input.timeToPay,
        }),
      },
    );

    return {
      ok,
      scheduleId: pick<string>(body, "schedule", "id") ?? null,
      raw: body,
    };
  }

  async cancelSchedule(scheduleId: string): Promise<{ ok: boolean; raw: unknown }> {
    const { ok, body } = await fetchJson(`/payment-schedules`, {
      method: "DELETE",
      headers: authHeaders(),
      body: JSON.stringify({ scheduleIds: [scheduleId] }),
    });
    return { ok, raw: body };
  }

  async deleteBillingKey(billingKey: string): Promise<{ ok: boolean; raw: unknown }> {
    const { ok, body } = await fetchJson(`/billing-keys/${encodeURIComponent(billingKey)}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    return { ok, raw: body };
  }

  async getPayment(paymentId: string): Promise<PaymentLookup> {
    const { ok, body } = await fetchJson(`/payments/${encodeURIComponent(paymentId)}`, {
      method: "GET",
      headers: authHeaders(),
    });

    if (!ok) {
      return {
        paymentId,
        status: "unknown",
        amount: 0,
        orderName: null,
        receiptUrl: null,
        failureReason: pick<string>(body, "message") ?? null,
        raw: body,
      };
    }

    return {
      paymentId,
      status: normalizeStatus(pick<string>(body, "status")),
      amount: pick<number>(body, "amount", "total") ?? 0,
      orderName: pick<string>(body, "orderName") ?? null,
      receiptUrl: pick<string>(body, "receiptUrl") ?? null,
      failureReason: pick<string>(body, "failure", "reason") ?? null,
      raw: body,
    };
  }

  async getBillingKeyInfo(
    billingKey: string,
  ): Promise<{ brand: string | null; last4: string | null }> {
    const { ok, body } = await fetchJson(`/billing-keys/${encodeURIComponent(billingKey)}`, {
      method: "GET",
      headers: authHeaders(),
    });
    if (!ok) return { brand: null, last4: null };
    // v2 returns methods[].card.{ publisher, number (masked) }.
    const methods = pick<unknown[]>(body, "methods");
    const card = Array.isArray(methods) ? pick(methods[0], "card") : pick(body, "card");
    const number = pick<string>(card, "number") ?? null;
    return {
      brand: pick<string>(card, "publisher") ?? pick<string>(card, "issuer") ?? null,
      last4: number ? number.replace(/\D/g, "").slice(-4) || null : null,
    };
  }

  verifyWebhook(headers: Record<string, string>, rawBody: string): WebhookVerifyResult {
    const secret = env.PORTONE_WEBHOOK_SECRET;
    if (!secret) return { ok: false, reason: "PORTONE_WEBHOOK_SECRET not configured" };

    const whHeaders = extractWebhookHeaders(headers);
    const verdict = verifyStandardWebhook(secret, whHeaders, rawBody);
    if (!verdict.ok) return { ok: false, reason: verdict.reason };

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      return { ok: false, reason: "invalid JSON body" };
    }

    const type = pick<string>(parsed, "type") ?? "unknown";
    const paymentId =
      pick<string>(parsed, "data", "paymentId") ?? pick<string>(parsed, "paymentId") ?? null;

    return {
      ok: true,
      // webhook-id is the idempotency key; fall back to paymentId+type if absent.
      eventId: whHeaders.id ?? `${paymentId ?? "unknown"}:${type}`,
      type,
      paymentId,
      raw: parsed,
    };
  }
}
