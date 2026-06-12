"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { action, ActionException } from "@/lib/actions/safe-action";
import { logAudit } from "@/lib/audit";
import { requireOwner } from "@/lib/auth/guards";
import { getPaymentProvider } from "@/lib/billing/index";
import { PLANS, TRIAL_DAYS } from "@/lib/billing/plans";
import { chargeAndActivate, orderName } from "@/lib/billing/service";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { WorkspacePlan } from "@/types/database.types";

/**
 * Subscription management actions (owner only). Billing tables are service-role
 * only, so these use the admin client; when it (or the provider) is missing the
 * action returns a friendly error and the rest of the app keeps working.
 */

const paidPlan = z.enum(["team", "pro"]);

const subscribeSchema = z.object({
  plan: paidPlan,
  seats: z.coerce.number().int().min(1).max(500).default(1),
  billingKey: z.string().trim().min(1, "결제 수단 정보가 없습니다."),
  cardBrand: z.string().trim().optional(),
  cardLast4: z.string().trim().max(4).optional(),
});

const changePlanSchema = z.object({
  plan: paidPlan,
  seats: z.coerce.number().int().min(1).max(500).default(1),
});

const updateMethodSchema = z.object({
  billingKey: z.string().trim().min(1),
  cardBrand: z.string().trim().optional(),
  cardLast4: z.string().trim().max(4).optional(),
});

const startTrialSchema = z.object({ plan: paidPlan.default("pro") });

/** Resolve the admin client + provider, or throw a friendly "준비중" error. */
function requireBilling() {
  const admin = createAdminClient();
  const provider = getPaymentProvider();
  if (!provider || !admin) {
    throw new ActionException("FORBIDDEN", "결제가 아직 준비 중입니다. 관리자에게 문의해 주세요.");
  }
  return { admin, provider };
}

/** Minimum seats = active members + pending invitations (can't bill below usage). */
async function minSeats(): Promise<number> {
  const supabase = await createClient();
  const [{ count: members }, { count: invites }] = await Promise.all([
    supabase.from("members").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase
      .from("invitations")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
  ]);
  return Math.max(1, (members ?? 0) + (invites ?? 0));
}

function normalizeSeats(plan: WorkspacePlan, seats: number, floor: number): number {
  // pro is flat-rate; seats are informational. team bills per seat.
  return plan === "team" ? Math.max(seats, floor) : Math.max(1, floor);
}

// ---------------------------------------------------------------------------
// Start a paid subscription (charges the first cycle immediately).
// ---------------------------------------------------------------------------
export const subscribeAction = action(subscribeSchema, async (input) => {
  const session = await requireOwner();
  const { admin, provider } = requireBilling();
  const seats = normalizeSeats(input.plan, input.seats, await minSeats());

  // Resolve masked card info for display when the SDK didn't supply it.
  const card = input.cardLast4
    ? { brand: input.cardBrand ?? null, last4: input.cardLast4 }
    : await provider.getBillingKeyInfo(input.billingKey);

  const result = await chargeAndActivate(admin, {
    workspaceId: session.workspace.id,
    plan: input.plan,
    seats,
    billingKey: input.billingKey,
    customerName: session.workspace.name,
    customerEmail: session.email,
    cardBrand: card.brand,
    cardLast4: card.last4,
  });

  if (!result.ok) {
    throw new ActionException("INTERNAL", result.reason);
  }

  await logAudit({
    workspaceId: session.workspace.id,
    actorMemberId: session.member.id,
    action: "billing.subscribed",
    meta: { plan: input.plan, seats, amount: result.amount },
  });

  revalidatePath("/billing");
  revalidatePath("/", "layout");
  return { plan: input.plan, seats };
});

// ---------------------------------------------------------------------------
// Change plan / seats on an existing subscription (reuses the stored card).
// New amount applies from the next cycle; entitlements update immediately.
// ---------------------------------------------------------------------------
export const changePlanAction = action(changePlanSchema, async (input) => {
  const session = await requireOwner();
  const { admin, provider } = requireBilling();

  const { data: account } = await admin
    .from("billing_accounts")
    .select("billing_key, subscription_id")
    .eq("workspace_id", session.workspace.id)
    .maybeSingle();
  if (!account?.billing_key) {
    throw new ActionException("CONFLICT", "활성 구독이 없습니다. 먼저 구독을 시작해 주세요.");
  }

  const seats = normalizeSeats(input.plan, input.seats, await minSeats());

  // Reschedule the next charge at the new amount.
  if (account.subscription_id) {
    await provider.cancelSchedule(account.subscription_id).catch(() => undefined);
  }

  const { data: ws } = await admin
    .from("workspaces")
    .select("current_period_end")
    .eq("id", session.workspace.id)
    .maybeSingle();
  const timeToPay = ws?.current_period_end ?? new Date(Date.now() + 86_400_000).toISOString();

  const nextPaymentId = `pay_${session.workspace.id}_${Date.now()}`;
  const sched = await provider.schedule({
    paymentId: nextPaymentId,
    billingKey: account.billing_key,
    orderName: orderName(input.plan, seats),
    amount: PLANS[input.plan].perSeat
      ? PLANS[input.plan].monthlyPrice * seats
      : PLANS[input.plan].monthlyPrice,
    customer: { customerKey: session.workspace.id },
    timeToPay,
  });

  await admin
    .from("billing_accounts")
    .update({ plan: input.plan, seats, subscription_id: sched.scheduleId })
    .eq("workspace_id", session.workspace.id);

  await admin
    .from("workspaces")
    .update({ plan: input.plan, billing_seats: seats, subscription_status: "active" })
    .eq("id", session.workspace.id);

  await logAudit({
    workspaceId: session.workspace.id,
    actorMemberId: session.member.id,
    action: "billing.plan_changed",
    meta: { plan: input.plan, seats },
  });

  revalidatePath("/billing");
  revalidatePath("/", "layout");
  return { plan: input.plan, seats };
});

// ---------------------------------------------------------------------------
// Replace the saved payment method (new billing key from the SDK).
// ---------------------------------------------------------------------------
export const updatePaymentMethodAction = action(updateMethodSchema, async (input) => {
  const session = await requireOwner();
  const { admin, provider } = requireBilling();

  const { data: account } = await admin
    .from("billing_accounts")
    .select("billing_key")
    .eq("workspace_id", session.workspace.id)
    .maybeSingle();

  const card = input.cardLast4
    ? { brand: input.cardBrand ?? null, last4: input.cardLast4 }
    : await provider.getBillingKeyInfo(input.billingKey);

  await admin.from("billing_accounts").upsert(
    {
      workspace_id: session.workspace.id,
      provider: provider.name,
      billing_key: input.billingKey,
      customer_key: session.workspace.id,
    },
    { onConflict: "workspace_id" },
  );

  await admin
    .from("workspaces")
    .update({ card_brand: card.brand, card_last4: card.last4 })
    .eq("id", session.workspace.id);

  // Best-effort: revoke the old key at the provider.
  if (account?.billing_key && account.billing_key !== input.billingKey) {
    await provider.deleteBillingKey(account.billing_key).catch(() => undefined);
  }

  await logAudit({
    workspaceId: session.workspace.id,
    actorMemberId: session.member.id,
    action: "billing.method_updated",
    meta: { last4: card.last4 },
  });

  revalidatePath("/billing");
  return { last4: card.last4 };
});

// ---------------------------------------------------------------------------
// Cancel at period end (keeps access until current_period_end → then free).
// ---------------------------------------------------------------------------
export const cancelSubscriptionAction = action(z.object({}), async () => {
  const session = await requireOwner();
  const { admin, provider } = requireBilling();

  const { data: account } = await admin
    .from("billing_accounts")
    .select("subscription_id")
    .eq("workspace_id", session.workspace.id)
    .maybeSingle();
  if (account?.subscription_id) {
    await provider.cancelSchedule(account.subscription_id).catch(() => undefined);
  }

  await admin
    .from("workspaces")
    .update({ subscription_status: "canceled", cancel_at_period_end: true })
    .eq("id", session.workspace.id);
  await admin
    .from("billing_accounts")
    .update({ subscription_id: null })
    .eq("workspace_id", session.workspace.id);

  await logAudit({
    workspaceId: session.workspace.id,
    actorMemberId: session.member.id,
    action: "billing.canceled",
  });

  revalidatePath("/billing");
  revalidatePath("/", "layout");
  return { ok: true };
});

// ---------------------------------------------------------------------------
// Resume a cancellation before the period ends (reschedules the next charge).
// ---------------------------------------------------------------------------
export const resumeSubscriptionAction = action(z.object({}), async () => {
  const session = await requireOwner();
  const { admin, provider } = requireBilling();

  const { data: account } = await admin
    .from("billing_accounts")
    .select("billing_key, plan, seats")
    .eq("workspace_id", session.workspace.id)
    .maybeSingle();
  if (!account?.billing_key || !account.plan) {
    throw new ActionException("CONFLICT", "재개할 구독 정보가 없습니다.");
  }

  const { data: ws } = await admin
    .from("workspaces")
    .select("current_period_end")
    .eq("id", session.workspace.id)
    .maybeSingle();
  const timeToPay = ws?.current_period_end ?? new Date(Date.now() + 86_400_000).toISOString();

  const sched = await provider.schedule({
    paymentId: `pay_${session.workspace.id}_${Date.now()}`,
    billingKey: account.billing_key,
    orderName: orderName(account.plan, account.seats),
    amount: PLANS[account.plan].perSeat
      ? PLANS[account.plan].monthlyPrice * account.seats
      : PLANS[account.plan].monthlyPrice,
    customer: { customerKey: session.workspace.id },
    timeToPay,
  });

  await admin
    .from("workspaces")
    .update({ subscription_status: "active", cancel_at_period_end: false })
    .eq("id", session.workspace.id);
  await admin
    .from("billing_accounts")
    .update({ subscription_id: sched.scheduleId })
    .eq("workspace_id", session.workspace.id);

  await logAudit({
    workspaceId: session.workspace.id,
    actorMemberId: session.member.id,
    action: "billing.resumed",
  });

  revalidatePath("/billing");
  revalidatePath("/", "layout");
  return { ok: true };
});

// ---------------------------------------------------------------------------
// Start a 14-day free trial (no payment). Expires → downgrade to free.
// ---------------------------------------------------------------------------
export const startTrialAction = action(startTrialSchema, async ({ plan }) => {
  const session = await requireOwner();
  if (session.workspace.subscription_status !== "none") {
    throw new ActionException("CONFLICT", "이미 구독 또는 체험을 시작했습니다.");
  }
  const supabase = await createClient(); // owner can update own workspace via RLS

  const trialEnds = new Date(Date.now() + TRIAL_DAYS * 86_400_000).toISOString();
  const { error } = await supabase
    .from("workspaces")
    .update({ plan, subscription_status: "trialing", trial_ends_at: trialEnds })
    .eq("id", session.workspace.id);
  if (error) throw new ActionException("INTERNAL", "체험을 시작하지 못했습니다.");

  await logAudit({
    workspaceId: session.workspace.id,
    actorMemberId: session.member.id,
    action: "billing.trial_started",
    meta: { plan, trial_ends_at: trialEnds },
  });

  revalidatePath("/billing");
  revalidatePath("/", "layout");
  return { plan, trialEndsAt: trialEnds };
});
