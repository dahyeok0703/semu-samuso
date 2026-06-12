import "server-only";

/**
 * Payment provider adapter boundary.
 *
 * The rest of the app talks ONLY to this interface, never to PortOne directly,
 * so the implementation can be swapped (e.g. PortOne v2 → 토스페이먼츠 직연동)
 * without touching billing actions, the webhook, or the UI. See portone.ts for
 * the default implementation and index.ts for the resolver/feature-gate.
 *
 * Amounts are integer KRW (원); currency is fixed to KRW for now.
 */

export type ProviderCustomer = {
  /** Stable per-workspace key. We use the workspace id. */
  customerKey: string;
  name?: string;
  email?: string | null;
};

export type ChargeInput = {
  /** Our idempotent payment id (encodes the workspace — see service.ts). */
  paymentId: string;
  billingKey: string;
  orderName: string;
  amount: number;
  customer: ProviderCustomer;
};

export type ChargeResult = {
  ok: boolean;
  paymentId: string;
  status: "paid" | "failed";
  receiptUrl?: string | null;
  failureReason?: string | null;
  raw: unknown;
};

export type ScheduleInput = {
  paymentId: string;
  billingKey: string;
  orderName: string;
  amount: number;
  customer: ProviderCustomer;
  /** ISO timestamp of the next charge. */
  timeToPay: string;
};

export type ScheduleResult = {
  ok: boolean;
  /** Provider schedule id (stored as billing_accounts.subscription_id). */
  scheduleId: string | null;
  raw: unknown;
};

export type PaymentLookup = {
  paymentId: string;
  status: "paid" | "failed" | "canceled" | "pending" | "unknown";
  amount: number;
  orderName: string | null;
  receiptUrl: string | null;
  failureReason: string | null;
  raw: unknown;
};

/** Result of verifying an inbound webhook (signature + parse). */
export type WebhookVerifyResult =
  | { ok: true; eventId: string; type: string; paymentId: string | null; raw: unknown }
  | { ok: false; reason: string };

export interface PaymentProvider {
  readonly name: string;

  /** Immediately charge a stored billing key (first cycle / retries). */
  charge(input: ChargeInput): Promise<ChargeResult>;

  /** Register the next recurring charge. */
  schedule(input: ScheduleInput): Promise<ScheduleResult>;

  /** Cancel a previously scheduled charge (best-effort). */
  cancelSchedule(scheduleId: string): Promise<{ ok: boolean; raw: unknown }>;

  /** Delete a billing key on cancellation (best-effort). */
  deleteBillingKey(billingKey: string): Promise<{ ok: boolean; raw: unknown }>;

  /** Server-side source-of-truth lookup of a payment (never trust the webhook body). */
  getPayment(paymentId: string): Promise<PaymentLookup>;

  /** Masked card metadata for a billing key (display only). */
  getBillingKeyInfo(billingKey: string): Promise<{ brand: string | null; last4: string | null }>;

  /** Verify an inbound webhook's signature and extract its identifiers. */
  verifyWebhook(headers: Record<string, string>, rawBody: string): WebhookVerifyResult;
}
