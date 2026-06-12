import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getPaymentProvider } from "@/lib/billing/index";
import { newPaymentId, workspaceIdFromPaymentId } from "@/lib/billing/payment-id";
import { monthlyAmount, planLabel } from "@/lib/billing/plans";
import type { WebhookVerifyResult } from "@/lib/billing/provider";
import type { Database, Json, WorkspacePlan } from "@/types/database.types";

export { newPaymentId, workspaceIdFromPaymentId };

/**
 * Subscription lifecycle + idempotent webhook processing. All functions take an
 * admin (service-role) client because billing_accounts/payments are reserved
 * for the service role, and webhooks run without a user session.
 */

type Admin = SupabaseClient<Database>;

/** Days of grace after a failed charge before the plan is downgraded. */
export const GRACE_DAYS = 3;

function addMonthsISO(from: Date, months: number): string {
  const d = new Date(from);
  d.setMonth(d.getMonth() + months);
  return d.toISOString();
}
function addDaysISO(from: Date, days: number): string {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export function orderName(plan: WorkspacePlan, seats: number): string {
  const label = planLabel(plan);
  return plan === "team" ? `세무사무소 ${label} 구독 (${seats}석)` : `세무사무소 ${label} 구독`;
}

// ---------------------------------------------------------------------------
// Charge the first cycle and activate the subscription. Used by the
// startSubscription / updatePaymentMethod actions.
// ---------------------------------------------------------------------------
export type ActivateInput = {
  workspaceId: string;
  plan: WorkspacePlan;
  seats: number;
  billingKey: string;
  customerName: string;
  customerEmail: string | null;
  cardBrand?: string | null;
  cardLast4?: string | null;
};

export type ActivateResult =
  | { ok: true; paymentId: string; amount: number }
  | { ok: false; reason: string; paymentId: string };

export async function chargeAndActivate(
  admin: Admin,
  input: ActivateInput,
): Promise<ActivateResult> {
  const provider = getPaymentProvider();
  if (!provider) return { ok: false, reason: "billing not configured", paymentId: "" };

  const amount = monthlyAmount(input.plan, input.seats);
  const paymentId = newPaymentId(input.workspaceId);
  const name = orderName(input.plan, input.seats);

  // Persist the billing key first (service-role-only table) so a webhook that
  // races the charge can resolve the account.
  await admin.from("billing_accounts").upsert(
    {
      workspace_id: input.workspaceId,
      provider: provider.name,
      billing_key: input.billingKey,
      customer_key: input.workspaceId,
      plan: input.plan,
      seats: input.seats,
    },
    { onConflict: "workspace_id" },
  );

  const charge = await provider.charge({
    paymentId,
    billingKey: input.billingKey,
    orderName: name,
    amount,
    customer: {
      customerKey: input.workspaceId,
      name: input.customerName,
      email: input.customerEmail,
    },
  });

  if (!charge.ok) {
    await recordPayment(admin, {
      workspaceId: input.workspaceId,
      paymentId,
      status: "failed",
      plan: input.plan,
      seats: input.seats,
      amount,
      orderName: name,
      failureReason: charge.failureReason ?? "결제 실패",
      raw: charge.raw,
    });
    return { ok: false, reason: charge.failureReason ?? "결제에 실패했습니다.", paymentId };
  }

  const now = new Date();
  const periodEnd = addMonthsISO(now, 1);

  await recordPayment(admin, {
    workspaceId: input.workspaceId,
    paymentId,
    status: "paid",
    plan: input.plan,
    seats: input.seats,
    amount,
    orderName: name,
    receiptUrl: charge.receiptUrl ?? null,
    paidAt: now.toISOString(),
    raw: charge.raw,
  });

  await admin
    .from("workspaces")
    .update({
      plan: input.plan,
      billing_seats: input.seats,
      subscription_status: "active",
      current_period_end: periodEnd,
      grace_until: null,
      cancel_at_period_end: false,
      card_brand: input.cardBrand ?? null,
      card_last4: input.cardLast4 ?? null,
    })
    .eq("id", input.workspaceId);

  // Schedule the next cycle (self-perpetuating: each paid webhook reschedules).
  await scheduleNext(
    admin,
    input.workspaceId,
    input.plan,
    input.seats,
    input.billingKey,
    periodEnd,
  );

  return { ok: true, paymentId, amount };
}

async function scheduleNext(
  admin: Admin,
  workspaceId: string,
  plan: WorkspacePlan,
  seats: number,
  billingKey: string,
  timeToPay: string,
): Promise<void> {
  const provider = getPaymentProvider();
  if (!provider) return;
  const nextPaymentId = newPaymentId(workspaceId);
  const res = await provider.schedule({
    paymentId: nextPaymentId,
    billingKey,
    orderName: orderName(plan, seats),
    amount: monthlyAmount(plan, seats),
    customer: { customerKey: workspaceId },
    timeToPay,
  });
  if (res.scheduleId) {
    await admin
      .from("billing_accounts")
      .update({ subscription_id: res.scheduleId })
      .eq("workspace_id", workspaceId);
  }
}

// ---------------------------------------------------------------------------
// Persist a charge row (idempotent on provider_payment_id).
// ---------------------------------------------------------------------------
type RecordInput = {
  workspaceId: string;
  paymentId: string;
  status: "paid" | "failed" | "canceled" | "pending";
  plan?: WorkspacePlan | null;
  seats?: number | null;
  amount: number;
  orderName?: string | null;
  receiptUrl?: string | null;
  failureReason?: string | null;
  paidAt?: string | null;
  raw?: unknown;
};

export async function recordPayment(admin: Admin, input: RecordInput): Promise<void> {
  await admin.from("payments").upsert(
    {
      workspace_id: input.workspaceId,
      provider: getPaymentProvider()?.name ?? "portone",
      provider_payment_id: input.paymentId,
      status: input.status,
      plan: input.plan ?? null,
      seats: input.seats ?? null,
      amount: input.amount,
      order_name: input.orderName ?? null,
      receipt_url: input.receiptUrl ?? null,
      failure_reason: input.failureReason ?? null,
      paid_at: input.paidAt ?? null,
      raw: (input.raw ?? {}) as Json,
    },
    { onConflict: "provider_payment_id" },
  );
}

// ---------------------------------------------------------------------------
// Webhook processing — idempotent. Returns a small status object for the route.
// ---------------------------------------------------------------------------
export type WebhookOutcome =
  | { handled: true; duplicate: boolean; note: string }
  | { handled: false; note: string };

export async function applyVerifiedWebhook(
  admin: Admin,
  verify: Extract<WebhookVerifyResult, { ok: true }>,
): Promise<WebhookOutcome> {
  const workspaceId = workspaceIdFromPaymentId(verify.paymentId);
  if (!workspaceId) {
    // Ack so the provider stops retrying; nothing we can attribute.
    return { handled: false, note: "unresolvable workspace" };
  }

  // Idempotency gate: the unique event_key insert fails (23505) on re-delivery.
  const { error: dupErr } = await admin.from("billing_events").insert({
    workspace_id: workspaceId,
    type: `webhook.${verify.type}`,
    event_key: verify.eventId,
    raw: verify.raw as Json,
  });
  if (dupErr) {
    if (dupErr.code === "23505")
      return { handled: true, duplicate: true, note: "already processed" };
    // Logging failure shouldn't block processing, but surface it.
    console.error("[billing] billing_events insert failed:", dupErr.message);
  }

  const provider = getPaymentProvider();
  if (!provider || !verify.paymentId) {
    return { handled: false, note: "provider unavailable" };
  }

  // Source of truth: re-fetch the payment from the provider.
  const lookup = await provider.getPayment(verify.paymentId);

  // Load the account/plan context for this workspace.
  const { data: account } = await admin
    .from("billing_accounts")
    .select("plan, seats, billing_key")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  const plan = (account?.plan ?? null) as WorkspacePlan | null;
  const seats = account?.seats ?? null;

  if (lookup.status === "paid") {
    await recordPayment(admin, {
      workspaceId,
      paymentId: verify.paymentId,
      status: "paid",
      plan,
      seats,
      amount: lookup.amount,
      orderName: lookup.orderName,
      receiptUrl: lookup.receiptUrl,
      paidAt: new Date().toISOString(),
      raw: lookup.raw,
    });

    const now = new Date();
    const periodEnd = addMonthsISO(now, 1);

    // Respect a pending cancellation: don't reactivate or reschedule.
    const { data: ws } = await admin
      .from("workspaces")
      .select("cancel_at_period_end")
      .eq("id", workspaceId)
      .maybeSingle();

    await admin
      .from("workspaces")
      .update({
        subscription_status: ws?.cancel_at_period_end ? "canceled" : "active",
        current_period_end: periodEnd,
        grace_until: null,
        ...(plan ? { plan } : {}),
        ...(seats ? { billing_seats: seats } : {}),
      })
      .eq("id", workspaceId);

    if (!ws?.cancel_at_period_end && plan && seats && account?.billing_key) {
      await scheduleNext(admin, workspaceId, plan, seats, account.billing_key, periodEnd);
    }

    return { handled: true, duplicate: false, note: "payment recorded (paid)" };
  }

  if (lookup.status === "failed") {
    await recordPayment(admin, {
      workspaceId,
      paymentId: verify.paymentId,
      status: "failed",
      plan,
      seats,
      amount: lookup.amount,
      orderName: lookup.orderName,
      failureReason: lookup.failureReason ?? "결제 실패",
      raw: lookup.raw,
    });

    // Enter grace: keep access for GRACE_DAYS, then the cron/effective-plan
    // resolution downgrades to free.
    await admin
      .from("workspaces")
      .update({
        subscription_status: "past_due",
        grace_until: addDaysISO(new Date(), GRACE_DAYS),
      })
      .eq("id", workspaceId);

    return { handled: true, duplicate: false, note: "payment recorded (failed) — grace started" };
  }

  if (lookup.status === "canceled") {
    await recordPayment(admin, {
      workspaceId,
      paymentId: verify.paymentId,
      status: "canceled",
      plan,
      seats,
      amount: lookup.amount,
      raw: lookup.raw,
    });
    return { handled: true, duplicate: false, note: "payment canceled" };
  }

  return { handled: true, duplicate: false, note: `ignored status: ${lookup.status}` };
}
