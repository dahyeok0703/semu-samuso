import { addDays, toISO } from "@/lib/filing-rules/dates";
import { codesForCategory, type FilingCategory } from "@/lib/filing-rules/filing-types";
import { createClient } from "@/lib/supabase/server";
import type { DocsStatus, FilingStatus } from "@/types/database.types";

export type ExpectedDoc = {
  id: string;
  doc_type: string;
  is_received: boolean;
};

export type ScheduleTask = {
  id: string;
  filing_type: string;
  period_label: string;
  due_date: string | null;
  status: FilingStatus;
  docs_status: DocsStatus;
  assigned_member_id: string | null;
  expectedDocuments: ExpectedDoc[];
};

/** Full filing schedule for a client (tasks + their expected-document checklist). */
export async function getClientSchedule(clientId: string): Promise<ScheduleTask[]> {
  const supabase = await createClient();
  const { data: tasks } = await supabase
    .from("filing_tasks")
    .select("id, filing_type, period_label, due_date, status, docs_status, assigned_member_id")
    .eq("client_id", clientId)
    .order("due_date", { ascending: true, nullsFirst: false });

  const rows = tasks ?? [];
  if (rows.length === 0) return [];

  const { data: docs } = await supabase
    .from("expected_documents")
    .select("id, filing_task_id, doc_type, is_received")
    .in(
      "filing_task_id",
      rows.map((t) => t.id),
    );

  const byTask = new Map<string, ExpectedDoc[]>();
  for (const d of docs ?? []) {
    const list = byTask.get(d.filing_task_id) ?? [];
    list.push({ id: d.id, doc_type: d.doc_type, is_received: d.is_received });
    byTask.set(d.filing_task_id, list);
  }

  return rows.map((t) => ({ ...t, expectedDocuments: byTask.get(t.id) ?? [] }));
}

export type CalendarTask = {
  id: string;
  client_id: string;
  client_name: string;
  filing_type: string;
  period_label: string;
  due_date: string;
  status: FilingStatus;
  docs_status: DocsStatus;
  assigned_member_id: string | null;
  assignee_name: string | null;
};

export type CalendarFilters = {
  assigned?: string;
  category?: FilingCategory;
  status?: FilingStatus;
};

/**
 * Tasks whose due_date falls in [startISO, endISO] (inclusive), with client +
 * assignee names attached. Used by the company-wide calendar grid and list.
 */
export async function listCalendarTasks(
  startISO: string,
  endISO: string,
  filters: CalendarFilters = {},
): Promise<CalendarTask[]> {
  const supabase = await createClient();

  let query = supabase
    .from("filing_tasks")
    .select(
      "id, client_id, filing_type, period_label, due_date, status, docs_status, assigned_member_id",
    )
    .not("due_date", "is", null)
    .gte("due_date", startISO)
    .lte("due_date", endISO);

  if (filters.assigned) query = query.eq("assigned_member_id", filters.assigned);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.category) query = query.in("filing_type", codesForCategory(filters.category));

  const { data: tasks } = await query.order("due_date", { ascending: true });
  const rows = tasks ?? [];
  if (rows.length === 0) return [];

  const clientIds = [...new Set(rows.map((t) => t.client_id))];
  const memberIds = [...new Set(rows.map((t) => t.assigned_member_id).filter(Boolean))] as string[];

  const [{ data: clients }, { data: members }] = await Promise.all([
    supabase.from("clients").select("id, biz_name").in("id", clientIds),
    memberIds.length > 0
      ? supabase.from("members").select("id, name").in("id", memberIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);

  const clientName = new Map((clients ?? []).map((c) => [c.id, c.biz_name]));
  const memberName = new Map((members ?? []).map((m) => [m.id, m.name]));

  return rows.map((t) => ({
    id: t.id,
    client_id: t.client_id,
    client_name: clientName.get(t.client_id) ?? "(거래처)",
    filing_type: t.filing_type,
    period_label: t.period_label,
    due_date: t.due_date as string,
    status: t.status,
    docs_status: t.docs_status,
    assigned_member_id: t.assigned_member_id,
    assignee_name: t.assigned_member_id ? (memberName.get(t.assigned_member_id) ?? null) : null,
  }));
}

/** Inclusive [start, end] ISO dates of the 6-week calendar grid for a month. */
export function calendarGridRange(year: number, month: number): { start: string; end: string } {
  const firstISO = toISO(year, month, 1);
  const firstDow = new Date(`${firstISO}T00:00:00Z`).getUTCDay(); // 0=Sun
  const start = addDays(firstISO, -firstDow);
  const end = addDays(start, 41); // 6 weeks * 7 - 1
  return { start, end };
}
