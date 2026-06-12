import "server-only";

import { entitlementsFor } from "@/lib/billing/gating";
import type { Entitlements } from "@/lib/billing/entitlements";
import { requireSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { Payment, Workspace } from "@/types/database.types";

export type BillingSummary = {
  workspace: Workspace;
  entitlements: Entitlements;
  /** Card display metadata (safe — no billing key). */
  card: { brand: string | null; last4: string | null } | null;
  payments: Payment[];
  /** Live usage counts for the limit meters. */
  usage: { clients: number; seats: number };
};

/** Owner-facing billing overview for /app/billing (RLS scopes everything). */
export async function getBillingSummary(): Promise<BillingSummary> {
  const session = await requireSession();
  const supabase = await createClient();
  const ws = session.workspace;

  const [{ data: payments }, { count: clients }, { count: members }, { count: invites }] =
    await Promise.all([
      supabase.from("payments").select("*").order("created_at", { ascending: false }).limit(24),
      supabase.from("clients").select("id", { count: "exact", head: true }).neq("status", "ended"),
      supabase.from("members").select("id", { count: "exact", head: true }).eq("status", "active"),
      supabase
        .from("invitations")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
    ]);

  return {
    workspace: ws,
    entitlements: entitlementsFor(ws),
    card: ws.card_last4 ? { brand: ws.card_brand, last4: ws.card_last4 } : null,
    payments: payments ?? [],
    usage: { clients: clients ?? 0, seats: (members ?? 0) + (invites ?? 0) },
  };
}
