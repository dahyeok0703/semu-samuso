"use server";

import { revalidatePath } from "next/cache";

import { action, ActionException } from "@/lib/actions/safe-action";
import { logAudit } from "@/lib/audit";
import { getSession, type SessionContext } from "@/lib/auth/session";
import { getClientAssigneeIds } from "@/lib/clients/queries";
import { generateFilingTasks, toClientForRules } from "@/lib/filing-rules/engine";
import { deriveDocsStatus } from "@/lib/filings/constants";
import {
  generateClientScheduleSchema,
  generateWorkspaceScheduleSchema,
  toggleExpectedDocumentSchema,
  updateFilingTaskDocsStatusSchema,
  updateFilingTaskStatusSchema,
} from "@/lib/filings/schemas";
import { createClient } from "@/lib/supabase/server";
import type { Client } from "@/types/database.types";

async function getActor(): Promise<SessionContext> {
  const session = await getSession();
  if (!session) throw new ActionException("UNAUTHORIZED", "로그인이 필요합니다.");
  return session;
}

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

/**
 * Persist the generated schedule for one client, skipping any
 * (filing_type, period_label) that already exists. Returns created/skipped.
 */
async function generateForClient(
  supabase: SupabaseServer,
  workspaceId: string,
  client: Client,
  year: number,
): Promise<{ created: number; skipped: number }> {
  const planned = generateFilingTasks(toClientForRules(client), year);
  if (planned.length === 0) return { created: 0, skipped: 0 };

  const { data: existing } = await supabase
    .from("filing_tasks")
    .select("filing_type, period_label")
    .eq("client_id", client.id);
  const existingKeys = new Set((existing ?? []).map((e) => `${e.filing_type}|${e.period_label}`));

  const toCreate = planned.filter((p) => !existingKeys.has(`${p.filingType}|${p.periodLabel}`));
  if (toCreate.length === 0) return { created: 0, skipped: planned.length };

  const { data: inserted, error } = await supabase
    .from("filing_tasks")
    .insert(
      toCreate.map((p) => ({
        workspace_id: workspaceId,
        client_id: client.id,
        filing_type: p.filingType,
        period_label: p.periodLabel,
        due_date: p.dueDate,
      })),
    )
    .select("id, filing_type, period_label");

  if (error) throw new ActionException("INTERNAL", "신고 일정을 생성하지 못했습니다.");

  // Attach expected-document checklists to the newly created tasks.
  const plannedByKey = new Map(toCreate.map((p) => [`${p.filingType}|${p.periodLabel}`, p]));
  const docRows: { workspace_id: string; filing_task_id: string; doc_type: string }[] = [];
  for (const task of inserted ?? []) {
    const p = plannedByKey.get(`${task.filing_type}|${task.period_label}`);
    if (!p) continue;
    for (const doc of p.expectedDocuments) {
      docRows.push({ workspace_id: workspaceId, filing_task_id: task.id, doc_type: doc });
    }
  }
  if (docRows.length > 0) {
    await supabase.from("expected_documents").insert(docRows);
  }

  return { created: inserted?.length ?? 0, skipped: planned.length - toCreate.length };
}

// ---------------------------------------------------------------------------
// Generate schedule for a single client
// ---------------------------------------------------------------------------
export const generateClientScheduleAction = action(
  generateClientScheduleSchema,
  async ({ clientId, year }) => {
    const session = await getActor();
    const supabase = await createClient();

    const { data: client } = await supabase
      .from("clients")
      .select("*")
      .eq("id", clientId)
      .maybeSingle();
    if (!client) throw new ActionException("NOT_FOUND", "거래처를 찾을 수 없습니다.");

    const assignees = await getClientAssigneeIds(clientId);
    const canWrite = session.member.role === "owner" || assignees.includes(session.member.id);
    if (!canWrite)
      throw new ActionException("FORBIDDEN", "이 거래처의 일정을 생성할 권한이 없습니다.");

    if (!client.tax_type) {
      throw new ActionException(
        "VALIDATION",
        "과세유형을 먼저 설정해야 일정을 생성할 수 있습니다.",
      );
    }

    const { created, skipped } = await generateForClient(
      supabase,
      session.workspace.id,
      client,
      year,
    );

    await logAudit({
      workspaceId: session.workspace.id,
      actorMemberId: session.member.id,
      action: "filing.schedule_generated",
      targetTable: "clients",
      targetId: clientId,
      meta: { year, created, skipped },
    });

    revalidatePath(`/clients/${clientId}`);
    revalidatePath("/calendar");
    return { created, skipped, year };
  },
);

// ---------------------------------------------------------------------------
// Batch: generate for every active client in the workspace (연초 일괄 생성)
// ---------------------------------------------------------------------------
export const generateWorkspaceScheduleAction = action(
  generateWorkspaceScheduleSchema,
  async ({ year }) => {
    const session = await getActor();
    if (session.member.role !== "owner") {
      throw new ActionException("FORBIDDEN", "일괄 생성은 대표(owner)만 가능합니다.");
    }
    const supabase = await createClient();

    const { data: clients } = await supabase.from("clients").select("*").eq("status", "active");

    let created = 0;
    let skipped = 0;
    let processed = 0;
    let skippedClients = 0;

    for (const client of clients ?? []) {
      if (!client.tax_type) {
        skippedClients += 1;
        continue;
      }
      const res = await generateForClient(supabase, session.workspace.id, client, year);
      created += res.created;
      skipped += res.skipped;
      processed += 1;
    }

    await logAudit({
      workspaceId: session.workspace.id,
      actorMemberId: session.member.id,
      action: "filing.schedule_batch_generated",
      meta: { year, processed, created, skipped, skippedClients },
    });

    revalidatePath("/calendar");
    revalidatePath("/clients");
    return { year, processed, created, skipped, skippedClients };
  },
);

// ---------------------------------------------------------------------------
// Task status / docs status changes
// ---------------------------------------------------------------------------
export const updateFilingTaskStatusAction = action(
  updateFilingTaskStatusSchema,
  async ({ id, status }) => {
    const session = await getActor();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("filing_tasks")
      .update({ status })
      .eq("id", id)
      .select("id, client_id")
      .maybeSingle();

    if (error) throw new ActionException("INTERNAL", "상태를 변경하지 못했습니다.");
    if (!data) throw new ActionException("FORBIDDEN", "이 업무의 상태를 변경할 권한이 없습니다.");

    await logAudit({
      workspaceId: session.workspace.id,
      actorMemberId: session.member.id,
      action: "filing.status_changed",
      targetTable: "filing_tasks",
      targetId: id,
      meta: { status },
    });

    revalidatePath(`/clients/${data.client_id}`);
    revalidatePath("/calendar");
    return { id, status };
  },
);

export const updateFilingTaskDocsStatusAction = action(
  updateFilingTaskDocsStatusSchema,
  async ({ id, docs_status }) => {
    const session = await getActor();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("filing_tasks")
      .update({ docs_status })
      .eq("id", id)
      .select("id, client_id")
      .maybeSingle();

    if (error) throw new ActionException("INTERNAL", "자료 상태를 변경하지 못했습니다.");
    if (!data) throw new ActionException("FORBIDDEN", "이 업무를 변경할 권한이 없습니다.");

    await logAudit({
      workspaceId: session.workspace.id,
      actorMemberId: session.member.id,
      action: "filing.docs_status_changed",
      targetTable: "filing_tasks",
      targetId: id,
      meta: { docs_status },
    });

    revalidatePath(`/clients/${data.client_id}`);
    revalidatePath("/calendar");
    return { id, docs_status };
  },
);

// ---------------------------------------------------------------------------
// Toggle an expected document; auto-derive the parent task docs_status.
// ---------------------------------------------------------------------------
export const toggleExpectedDocumentAction = action(
  toggleExpectedDocumentSchema,
  async ({ id, is_received }) => {
    const session = await getActor();
    const supabase = await createClient();

    const { data: doc } = await supabase
      .from("expected_documents")
      .select("id, filing_task_id")
      .eq("id", id)
      .maybeSingle();
    if (!doc) throw new ActionException("NOT_FOUND", "서류 항목을 찾을 수 없습니다.");

    const { data: updated, error } = await supabase
      .from("expected_documents")
      .update({ is_received })
      .eq("id", id)
      .select("id")
      .maybeSingle();
    if (error) throw new ActionException("INTERNAL", "서류 상태를 변경하지 못했습니다.");
    if (!updated) throw new ActionException("FORBIDDEN", "이 서류를 변경할 권한이 없습니다.");

    // Recompute the task's docs_status from its checklist.
    const { data: all } = await supabase
      .from("expected_documents")
      .select("is_received")
      .eq("filing_task_id", doc.filing_task_id);
    const total = all?.length ?? 0;
    const received = (all ?? []).filter((d) => d.is_received).length;
    const docsStatus = deriveDocsStatus(received, total);

    const { data: task } = await supabase
      .from("filing_tasks")
      .update({ docs_status: docsStatus })
      .eq("id", doc.filing_task_id)
      .select("client_id")
      .maybeSingle();

    await logAudit({
      workspaceId: session.workspace.id,
      actorMemberId: session.member.id,
      action: "filing.document_toggled",
      targetTable: "expected_documents",
      targetId: id,
      meta: { is_received, docs_status: docsStatus },
    });

    if (task?.client_id) revalidatePath(`/clients/${task.client_id}`);
    revalidatePath("/calendar");
    return { id, is_received, docsStatus, filingTaskId: doc.filing_task_id };
  },
);
