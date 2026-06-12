import "server-only";

import { entitlementsFor } from "@/lib/billing/gating";
import { monthlyAmount } from "@/lib/billing/plans";
import { requireSession } from "@/lib/auth/session";
import { computeMargin, type MarginResult } from "@/lib/pricing/margin";
import { messageCostKrw } from "@/lib/pricing/cogs";
import { summarizeQuota, type QuotaUsage } from "@/lib/pricing/quota";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Workspace } from "@/types/database.types";

function firstOfMonthISO(d = new Date()): string {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Owner dashboard: this month's document usage vs quota.
// ---------------------------------------------------------------------------
export async function getWorkspaceQuotaUsage(): Promise<QuotaUsage> {
  const session = await requireSession();
  const supabase = await createClient();
  const { data } = await supabase
    .from("ai_usage")
    .select("doc_count")
    .eq("workspace_id", session.workspace.id)
    .eq("month", firstOfMonthISO())
    .maybeSingle();
  return summarizeQuota(session.workspace, data?.doc_count ?? 0);
}

// ---------------------------------------------------------------------------
// Internal (superuser) margin monitor — cross-workspace. Needs the service role
// (bypasses RLS). The PAGE must gate on isSuperuser() before calling this.
// ---------------------------------------------------------------------------
export type MarginRow = {
  workspaceId: string;
  name: string;
  plan: Workspace["plan"];
  effectivePlan: Workspace["plan"];
  seats: number;
  docCount: number;
  overageDocs: number;
  margin: MarginResult;
};

export type MarginMonitor = {
  available: boolean;
  month: string;
  rows: MarginRow[];
  flaggedCount: number;
};

export async function getMarginMonitor(): Promise<MarginMonitor> {
  const admin = createAdminClient();
  const month = firstOfMonthISO();
  if (!admin) return { available: false, month, rows: [], flaggedCount: 0 };

  const monthStartIso = `${month}T00:00:00Z`;
  const [{ data: workspaces }, { data: usage }, { data: reminders }] = await Promise.all([
    admin.from("workspaces").select("*"),
    admin
      .from("ai_usage")
      .select("workspace_id, est_cost_krw, overage_cost_krw, doc_count, overage_docs")
      .eq("month", month),
    admin.from("reminders").select("workspace_id, channel").gte("created_at", monthStartIso),
  ]);

  const usageByWs = new Map(
    (usage ?? []).map((u) => [
      u.workspace_id,
      {
        aiCost: Number(u.est_cost_krw),
        overageRevenue: Number(u.overage_cost_krw),
        docCount: u.doc_count,
        overageDocs: u.overage_docs,
      },
    ]),
  );

  // Message COGS per workspace from this month's reminders.
  const msgCostByWs = new Map<string, number>();
  for (const r of reminders ?? []) {
    const prev = msgCostByWs.get(r.workspace_id) ?? 0;
    msgCostByWs.set(r.workspace_id, prev + messageCostKrw(r.channel, 1));
  }

  const rows: MarginRow[] = (workspaces ?? []).map((ws) => {
    const u = usageByWs.get(ws.id);
    const ent = entitlementsFor(ws);
    // Revenue: only an active paid subscription contributes MRR.
    const mrr = ws.subscription_status === "active" ? monthlyAmount(ws.plan, ws.billing_seats) : 0;
    const margin = computeMargin({
      mrrKrw: mrr,
      extraRevenueKrw: u?.overageRevenue ?? 0,
      aiCostKrw: u?.aiCost ?? 0,
      messageCostKrw: msgCostByWs.get(ws.id) ?? 0,
    });
    return {
      workspaceId: ws.id,
      name: ws.name,
      plan: ws.plan,
      effectivePlan: ent.effectivePlan,
      seats: ws.billing_seats,
      docCount: u?.docCount ?? 0,
      overageDocs: u?.overageDocs ?? 0,
      margin,
    };
  });

  // Flagged first, then lowest margin.
  rows.sort((a, b) => {
    if (a.margin.flagged !== b.margin.flagged) return a.margin.flagged ? -1 : 1;
    return (a.margin.marginRate ?? 1) - (b.margin.marginRate ?? 1);
  });

  return {
    available: true,
    month,
    rows,
    flaggedCount: rows.filter((r) => r.margin.flagged).length,
  };
}
