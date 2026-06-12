import "server-only";

import { ActionException } from "@/lib/actions/safe-action";
import {
  checkClientLimit,
  checkIntegration,
  checkSeatLimit,
  resolveEntitlements,
  type Entitlements,
} from "@/lib/billing/entitlements";
import type { Integration } from "@/lib/billing/plans";
import { getSession, type SessionContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { Workspace } from "@/types/database.types";

/**
 * Plan/seat/integration enforcement for server actions. The authoritative
 * boundary lives here (not in middleware): middleware can't cheaply count rows,
 * and these checks run inside the same actions that mutate the data, so a
 * downgraded workspace cannot exceed its limits regardless of the UI state.
 */

/** Compute entitlements from a workspace record (no extra query). */
export function entitlementsFor(workspace: Workspace, now: Date = new Date()): Entitlements {
  return resolveEntitlements(
    {
      plan: workspace.plan,
      subscription_status: workspace.subscription_status,
      trial_ends_at: workspace.trial_ends_at,
      current_period_end: workspace.current_period_end,
      grace_until: workspace.grace_until,
    },
    now,
  );
}

async function currentSession(): Promise<SessionContext> {
  const session = await getSession();
  if (!session) throw new ActionException("UNAUTHORIZED", "로그인이 필요합니다.");
  return session;
}

/** Count active clients in the caller's workspace (RLS scopes the query). */
async function countClients(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("clients")
    .select("id", { count: "exact", head: true })
    .neq("status", "ended");
  return count ?? 0;
}

/** Count seats in use: active members + pending invitations. */
async function countSeats(): Promise<number> {
  const supabase = await createClient();
  const [{ count: members }, { count: invites }] = await Promise.all([
    supabase.from("members").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase
      .from("invitations")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
  ]);
  return (members ?? 0) + (invites ?? 0);
}

/**
 * Throw FORBIDDEN if adding `adding` clients would exceed the plan limit.
 * Returns the resolved entitlements so callers can reuse them.
 */
export async function assertClientCapacity(adding = 1): Promise<Entitlements> {
  const session = await currentSession();
  const ent = entitlementsFor(session.workspace);
  if (ent.limits.maxClients === null) return ent; // unlimited fast-path
  const current = await countClients();
  const check = checkClientLimit(ent, current + adding - 1);
  if (!check.allowed) {
    throw new ActionException("FORBIDDEN", check.reason ?? "플랜 한도를 초과했습니다.");
  }
  return ent;
}

/** Throw FORBIDDEN if adding `adding` seats would exceed the plan limit. */
export async function assertSeatCapacity(adding = 1): Promise<Entitlements> {
  const session = await currentSession();
  const ent = entitlementsFor(session.workspace);
  if (ent.limits.maxSeats === null) return ent;
  const current = await countSeats();
  const check = checkSeatLimit(ent, current, adding);
  if (!check.allowed) {
    throw new ActionException("FORBIDDEN", check.reason ?? "직원 한도를 초과했습니다.");
  }
  return ent;
}

/** Throw FORBIDDEN if the current plan does not include `integration`. */
export async function assertIntegrationEnabled(integration: Integration): Promise<Entitlements> {
  const session = await currentSession();
  const ent = entitlementsFor(session.workspace);
  const check = checkIntegration(ent, integration);
  if (!check.allowed) {
    throw new ActionException(
      "FORBIDDEN",
      check.reason ?? "현재 플랜에서 사용할 수 없는 기능입니다.",
    );
  }
  return ent;
}
