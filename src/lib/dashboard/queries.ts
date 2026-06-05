import {
  FILING_CATEGORY_LABELS,
  filingTypeCategory,
  filingTypeLabel,
  type FilingCategory,
} from "@/lib/filing-rules/filing-types";
import { daysUntil } from "@/lib/messaging/rules";
import { createClient } from "@/lib/supabase/server";
import type { FilingStatus } from "@/types/database.types";

const DONE_STATUSES: FilingStatus[] = ["filed", "done"];
const RISK_HORIZON_DAYS = 7;

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function weekRange(today: string): { start: string; end: string } {
  const dow = new Date(`${today}T00:00:00Z`).getUTCDay(); // 0 Sun..6 Sat
  const sinceMon = (dow + 6) % 7;
  const start = addDays(today, -sinceMon);
  return { start, end: addDays(start, 6) };
}
function monthRange(today: string): { start: string; end: string } {
  const [y, m] = today.split("-").map(Number);
  const start = `${today.slice(0, 7)}-01`;
  const end = new Date(Date.UTC(y!, m!, 0)).toISOString().slice(0, 10);
  return { start, end };
}

// ---------------------------------------------------------------------------
// Owner dashboard (workspace-wide aggregates)
// ---------------------------------------------------------------------------
export type OwnerDashboard = {
  week: { total: number; done: number };
  month: { total: number; done: number };
  riskCount: number;
  riskClients: {
    clientId: string;
    name: string;
    taskCount: number;
    nearestDays: number;
    missingDocs: number;
  }[];
  staffLoad: { name: string; open: number }[];
  progress: {
    label: string;
    pending: number;
    docs_received: number;
    filed: number;
    done: number;
  }[];
};

export async function getOwnerDashboard(): Promise<OwnerDashboard> {
  const supabase = await createClient();
  const today = todayISO();
  const week = weekRange(today);
  const month = monthRange(today);
  const horizon = addDays(today, RISK_HORIZON_DAYS);

  const [
    { data: weekTasks },
    { data: monthTasks },
    { data: openTasks },
    { data: riskTasks },
    { data: members },
  ] = await Promise.all([
    supabase
      .from("filing_tasks")
      .select("status")
      .gte("due_date", week.start)
      .lte("due_date", week.end),
    supabase
      .from("filing_tasks")
      .select("status, filing_type")
      .gte("due_date", month.start)
      .lte("due_date", month.end),
    supabase
      .from("filing_tasks")
      .select("assigned_member_id")
      .not("status", "in", "(filed,done)")
      .not("due_date", "is", null),
    supabase
      .from("filing_tasks")
      .select("id, client_id, due_date")
      .gte("due_date", today)
      .lte("due_date", horizon)
      .neq("docs_status", "complete")
      .not("status", "in", "(filed,done)"),
    supabase.from("members").select("id, name").eq("status", "active"),
  ]);

  const isDone = (s: string) => DONE_STATUSES.includes(s as FilingStatus);
  const weekRows = weekTasks ?? [];
  const monthRows = monthTasks ?? [];

  // Progress by category × status (this month).
  const progressMap = new Map<
    FilingCategory,
    { pending: number; docs_received: number; filed: number; done: number }
  >();
  for (const t of monthRows) {
    const cat = filingTypeCategory(t.filing_type);
    if (!cat) continue;
    const bucket = progressMap.get(cat) ?? { pending: 0, docs_received: 0, filed: 0, done: 0 };
    if (t.status in bucket) bucket[t.status as keyof typeof bucket] += 1;
    progressMap.set(cat, bucket);
  }
  const progress = [...progressMap.entries()].map(([cat, b]) => ({
    label: FILING_CATEGORY_LABELS[cat],
    ...b,
  }));

  // Staff load: open tasks per assigned member (+ unassigned).
  const loadMap = new Map<string, number>();
  let unassigned = 0;
  for (const t of openTasks ?? []) {
    if (!t.assigned_member_id) {
      unassigned += 1;
      continue;
    }
    loadMap.set(t.assigned_member_id, (loadMap.get(t.assigned_member_id) ?? 0) + 1);
  }
  const staffLoad = (members ?? [])
    .map((m) => ({ name: m.name, open: loadMap.get(m.id) ?? 0 }))
    .filter((s) => s.open > 0)
    .sort((a, b) => b.open - a.open);
  if (unassigned > 0) staffLoad.push({ name: "미배정", open: unassigned });

  // Risk clients (imminent + missing docs).
  const risk = riskTasks ?? [];
  let riskClients: OwnerDashboard["riskClients"] = [];
  if (risk.length > 0) {
    const clientIds = [...new Set(risk.map((t) => t.client_id))];
    const taskIds = risk.map((t) => t.id);
    const [{ data: clients }, { data: missing }] = await Promise.all([
      supabase.from("clients").select("id, biz_name").in("id", clientIds),
      supabase
        .from("expected_documents")
        .select("filing_task_id")
        .in("filing_task_id", taskIds)
        .eq("is_received", false),
    ]);
    const cName = new Map((clients ?? []).map((c) => [c.id, c.biz_name]));
    const missingByTask = new Map<string, number>();
    for (const m of missing ?? []) {
      missingByTask.set(m.filing_task_id, (missingByTask.get(m.filing_task_id) ?? 0) + 1);
    }
    const byClient = new Map<
      string,
      { taskCount: number; nearestDays: number; missingDocs: number }
    >();
    for (const t of risk) {
      const d = daysUntil(t.due_date as string, today);
      const cur = byClient.get(t.client_id) ?? {
        taskCount: 0,
        nearestDays: Infinity,
        missingDocs: 0,
      };
      cur.taskCount += 1;
      cur.nearestDays = Math.min(cur.nearestDays, d);
      cur.missingDocs += missingByTask.get(t.id) ?? 0;
      byClient.set(t.client_id, cur);
    }
    riskClients = [...byClient.entries()]
      .map(([clientId, v]) => ({
        clientId,
        name: cName.get(clientId) ?? "(거래처)",
        taskCount: v.taskCount,
        nearestDays: v.nearestDays === Infinity ? 0 : v.nearestDays,
        missingDocs: v.missingDocs,
      }))
      .sort((a, b) => a.nearestDays - b.nearestDays || b.missingDocs - a.missingDocs)
      .slice(0, 8);
  }

  return {
    week: { total: weekRows.length, done: weekRows.filter((t) => isDone(t.status)).length },
    month: { total: monthRows.length, done: monthRows.filter((t) => isDone(t.status)).length },
    riskCount: new Set(risk.map((t) => t.client_id)).size,
    riskClients,
    staffLoad,
    progress,
  };
}

/** Counts for the owner "다음 할 일" CTA widget. */
export async function getSetupState(): Promise<{
  clients: number;
  tasks: number;
  members: number;
}> {
  const supabase = await createClient();
  const [c, t, m] = await Promise.all([
    supabase.from("clients").select("id", { count: "exact", head: true }),
    supabase.from("filing_tasks").select("id", { count: "exact", head: true }),
    supabase.from("members").select("id", { count: "exact", head: true }).eq("status", "active"),
  ]);
  return { clients: c.count ?? 0, tasks: t.count ?? 0, members: m.count ?? 0 };
}

// ---------------------------------------------------------------------------
// Staff dashboard (assigned scope only)
// ---------------------------------------------------------------------------
export type StaffTask = {
  taskId: string;
  clientId: string;
  clientName: string;
  filingLabel: string;
  periodLabel: string;
  dueDate: string;
  status: FilingStatus;
  docsStatus: string;
  daysLeft: number;
  missingDocs: string[];
};

export async function getStaffDashboard(memberId: string): Promise<StaffTask[]> {
  const supabase = await createClient();
  const today = todayISO();
  const horizon = addDays(today, 7);
  const floor = addDays(today, -30); // include recent overdue

  const { data: assigned } = await supabase
    .from("client_assignments")
    .select("client_id")
    .eq("member_id", memberId);
  const assignedClientIds = (assigned ?? []).map((a) => a.client_id);

  // Tasks for my clients OR explicitly assigned to me, due within the window.
  const orFilter = assignedClientIds.length
    ? `client_id.in.(${assignedClientIds.join(",")}),assigned_member_id.eq.${memberId}`
    : `assigned_member_id.eq.${memberId}`;

  const { data: tasks } = await supabase
    .from("filing_tasks")
    .select(
      "id, client_id, filing_type, period_label, due_date, status, docs_status, assigned_member_id",
    )
    .not("status", "in", "(filed,done)")
    .gte("due_date", floor)
    .lte("due_date", horizon)
    .or(orFilter)
    .order("due_date", { ascending: true });

  const rows = tasks ?? [];
  if (rows.length === 0) return [];

  const clientIds = [...new Set(rows.map((t) => t.client_id))];
  const taskIds = rows.map((t) => t.id);
  const [{ data: clients }, { data: missing }] = await Promise.all([
    supabase.from("clients").select("id, biz_name").in("id", clientIds),
    supabase
      .from("expected_documents")
      .select("filing_task_id, doc_type")
      .in("filing_task_id", taskIds)
      .eq("is_received", false),
  ]);

  const cName = new Map((clients ?? []).map((c) => [c.id, c.biz_name]));
  const missingByTask = new Map<string, string[]>();
  for (const m of missing ?? []) {
    const list = missingByTask.get(m.filing_task_id) ?? [];
    list.push(m.doc_type);
    missingByTask.set(m.filing_task_id, list);
  }

  return rows
    .filter((t) => t.due_date)
    .map((t) => ({
      taskId: t.id,
      clientId: t.client_id,
      clientName: cName.get(t.client_id) ?? "(거래처)",
      filingLabel: `${filingTypeLabel(t.filing_type)} ${t.period_label}`,
      periodLabel: t.period_label,
      dueDate: t.due_date as string,
      status: t.status,
      docsStatus: t.docs_status,
      daysLeft: daysUntil(t.due_date as string, today),
      missingDocs: missingByTask.get(t.id) ?? [],
    }));
}
