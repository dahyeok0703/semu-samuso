import { NextResponse } from "next/server";

import { resolveEntitlements } from "@/lib/billing/entitlements";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Daily billing maintenance: materialize trial/grace expiries into the stored
 * plan so a workspace that lapsed is downgraded to free even if no one opens
 * the app. Entitlement resolution is the source of truth; this just persists
 * the result for any background jobs that read `plan` directly.
 *
 * Auth: `Authorization: Bearer <CRON_SECRET>` when configured.
 */
export async function GET(request: Request) {
  if (env.CRON_SECRET) {
    if (request.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
  } else if (env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false, error: "CRON_SECRET 미설정" }, { status: 503 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY 미설정" },
      { status: 503 },
    );
  }

  const { data: workspaces } = await admin
    .from("workspaces")
    .select("id, plan, subscription_status, trial_ends_at, current_period_end, grace_until")
    .in("subscription_status", ["trialing", "past_due", "canceled"]);

  const now = new Date();
  let downgraded = 0;

  for (const ws of workspaces ?? []) {
    const ent = resolveEntitlements(
      {
        plan: ws.plan,
        subscription_status: ws.subscription_status,
        trial_ends_at: ws.trial_ends_at,
        current_period_end: ws.current_period_end,
        grace_until: ws.grace_until,
      },
      now,
    );

    if (ent.effectivePlan === "free" && (ws.plan !== "free" || ws.subscription_status !== "none")) {
      await admin
        .from("workspaces")
        .update({
          plan: "free",
          subscription_status: "none",
          billing_seats: 1,
          cancel_at_period_end: false,
          grace_until: null,
        })
        .eq("id", ws.id);
      downgraded += 1;
    }
  }

  return NextResponse.json({ ok: true, checked: workspaces?.length ?? 0, downgraded });
}
