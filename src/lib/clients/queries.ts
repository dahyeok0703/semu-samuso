import { cache } from "react";

import { digitsOnly } from "@/lib/clients/biz-reg-no";
import { CLIENT_PAGE_SIZE } from "@/lib/clients/constants";
import type { ClientListParams } from "@/lib/clients/schemas";
import { createClient } from "@/lib/supabase/server";
import type { Client } from "@/types/database.types";

export type Assignee = { id: string; name: string };
export type ClientWithAssignees = Client & { assignees: Assignee[] };

export type WorkspaceMember = { id: string; name: string; role: "owner" | "staff" };

/** Active members of the current workspace (for filters + assignment UI). */
export const listWorkspaceMembers = cache(async (): Promise<WorkspaceMember[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("members")
    .select("id, name, role")
    .eq("status", "active")
    .order("role", { ascending: true })
    .order("name", { ascending: true });
  return (data ?? []) as WorkspaceMember[];
});

/** Map of clientId -> assignees, for a set of clients. */
async function assigneesByClient(clientIds: string[]): Promise<Map<string, Assignee[]>> {
  const map = new Map<string, Assignee[]>();
  if (clientIds.length === 0) return map;

  const supabase = await createClient();
  const [{ data: assignments }, { data: members }] = await Promise.all([
    supabase.from("client_assignments").select("client_id, member_id").in("client_id", clientIds),
    supabase.from("members").select("id, name"),
  ]);

  const memberName = new Map((members ?? []).map((m) => [m.id, m.name]));
  for (const a of assignments ?? []) {
    const list = map.get(a.client_id) ?? [];
    list.push({ id: a.member_id, name: memberName.get(a.member_id) ?? "(알 수 없음)" });
    map.set(a.client_id, list);
  }
  return map;
}

export type ListClientsResult = {
  rows: ClientWithAssignees[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

export async function listClients(params: ClientListParams): Promise<ListClientsResult> {
  const supabase = await createClient();
  const pageSize = CLIENT_PAGE_SIZE;
  const from = (params.page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase.from("clients").select("*", { count: "exact" });

  // Search across 상호 / 사업자번호 / 대표자.
  const safe = params.q.replace(/[%,()*]/g, " ").trim();
  if (safe) {
    const ors = [`biz_name.ilike.*${safe}*`, `ceo_name.ilike.*${safe}*`];
    const digits = digitsOnly(params.q);
    if (digits) ors.push(`biz_reg_no.ilike.*${digits}*`);
    query = query.or(ors.join(","));
  }

  if (params.tax_type) query = query.eq("tax_type", params.tax_type);
  if (params.status) query = query.eq("status", params.status);

  if (params.assigned) {
    const { data: assignedRows } = await supabase
      .from("client_assignments")
      .select("client_id")
      .eq("member_id", params.assigned);
    const ids = (assignedRows ?? []).map((r) => r.client_id);
    if (ids.length === 0) {
      return { rows: [], total: 0, page: params.page, pageSize, pageCount: 0 };
    }
    query = query.in("id", ids);
  }

  query = query
    .order(params.sort, { ascending: params.dir === "asc" })
    .order("id", { ascending: true })
    .range(from, to);

  const { data, count } = await query;
  const rows = (data ?? []) as Client[];
  const assignees = await assigneesByClient(rows.map((r) => r.id));

  return {
    rows: rows.map((r) => ({ ...r, assignees: assignees.get(r.id) ?? [] })),
    total: count ?? 0,
    page: params.page,
    pageSize,
    pageCount: Math.max(1, Math.ceil((count ?? 0) / pageSize)),
  };
}

export const getClientById = cache(async (id: string): Promise<Client | null> => {
  const supabase = await createClient();
  const { data } = await supabase.from("clients").select("*").eq("id", id).maybeSingle();
  return data ?? null;
});

export const getClientAssigneeIds = cache(async (clientId: string): Promise<string[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("client_assignments")
    .select("member_id")
    .eq("client_id", clientId);
  return (data ?? []).map((r) => r.member_id);
});

// --- Detail tab reads (connection points for later stages) ------------------

export async function getClientFilingTasks(clientId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("filing_tasks")
    .select("id, filing_type, period_label, due_date, status, docs_status")
    .eq("client_id", clientId)
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(50);
  return data ?? [];
}

export async function getClientDocuments(clientId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("documents")
    .select("id, doc_type, source, status, received_at")
    .eq("client_id", clientId)
    .order("received_at", { ascending: false })
    .limit(50);
  return data ?? [];
}

export async function getClientReminders(clientId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("reminders")
    .select("id, channel, template_key, status, sent_at, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(50);
  return data ?? [];
}
