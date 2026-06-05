"use server";

import { revalidatePath } from "next/cache";

import { action, ActionException } from "@/lib/actions/safe-action";
import { logAudit } from "@/lib/audit";
import { digitsOnly } from "@/lib/clients/biz-reg-no";
import {
  bulkImportSchema,
  createClientSchema,
  deleteClientSchema,
  setAssignmentsSchema,
  updateClientSchema,
  updateClientStatusSchema,
  type ClientFormValues,
} from "@/lib/clients/schemas";
import { assertOwner, requireActor as getActor } from "@/lib/auth/guards";
import { getSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

const blankToNull = (value: string): string | null => {
  const t = value.trim();
  return t === "" ? null : t;
};

/** Map validated form values to a clients table row (workspace_id added by caller). */
function toClientRow(values: ClientFormValues) {
  return {
    biz_name: values.biz_name.trim(),
    biz_reg_no: values.biz_reg_no.trim() === "" ? null : digitsOnly(values.biz_reg_no),
    ceo_name: blankToNull(values.ceo_name),
    industry: blankToNull(values.industry),
    tax_type: values.tax_type,
    closing_month: values.closing_month,
    is_semiannual_withholding: values.is_semiannual_withholding,
    is_diligent_filing: values.is_diligent_filing,
    contact_phone: blankToNull(values.contact_phone),
    contact_kakao: blankToNull(values.contact_kakao),
    contact_email: blankToNull(values.contact_email),
    status: values.status,
    memo: blankToNull(values.memo),
  };
}

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

async function findDuplicate(
  supabase: SupabaseServer,
  bizRegNo: string | null,
  excludeId?: string,
): Promise<{ id: string; biz_name: string } | null> {
  if (!bizRegNo) return null;
  let q = supabase.from("clients").select("id, biz_name").eq("biz_reg_no", bizRegNo);
  if (excludeId) q = q.neq("id", excludeId);
  const { data } = await q.limit(1).maybeSingle();
  return data ?? null;
}

function duplicateError(name: string): ActionException {
  return new ActionException("CONFLICT", "이미 등록된 사업자등록번호입니다.", {
    biz_reg_no: [`동일한 사업자등록번호의 거래처(${name})가 이미 있습니다.`],
  });
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------
export const createClientAction = action(createClientSchema, async (values) => {
  const session = await getActor();
  assertOwner(session); // RLS reserves client creation for owners.
  const supabase = await createClient();
  const row = toClientRow(values);

  const dup = await findDuplicate(supabase, row.biz_reg_no);
  if (dup) throw duplicateError(dup.biz_name);

  const { data, error } = await supabase
    .from("clients")
    .insert({ ...row, workspace_id: session.workspace.id })
    .select("id")
    .single();

  if (error || !data) {
    if (error?.code === "23505") throw duplicateError(row.biz_name);
    throw new ActionException("INTERNAL", "거래처를 등록하지 못했습니다.");
  }

  await logAudit({
    workspaceId: session.workspace.id,
    actorMemberId: session.member.id,
    action: "client.created",
    targetTable: "clients",
    targetId: data.id,
    meta: { biz_name: row.biz_name },
  });

  revalidatePath("/clients");
  return { id: data.id };
});

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------
export const updateClientAction = action(updateClientSchema, async ({ id, ...values }) => {
  const session = await getActor();
  const supabase = await createClient();
  const row = toClientRow(values);

  const dup = await findDuplicate(supabase, row.biz_reg_no, id);
  if (dup) throw duplicateError(dup.biz_name);

  const { data, error } = await supabase
    .from("clients")
    .update(row)
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error?.code === "23505") throw duplicateError(row.biz_name);
  if (error) throw new ActionException("INTERNAL", "거래처를 수정하지 못했습니다.");
  if (!data) {
    // RLS filtered the row out: not in workspace, or staff not assigned.
    throw new ActionException("FORBIDDEN", "이 거래처를 수정할 권한이 없습니다.");
  }

  await logAudit({
    workspaceId: session.workspace.id,
    actorMemberId: session.member.id,
    action: "client.updated",
    targetTable: "clients",
    targetId: id,
    meta: { biz_name: row.biz_name },
  });

  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
  return { id };
});

// ---------------------------------------------------------------------------
// Status change (soft delete = status "ended")
// ---------------------------------------------------------------------------
export const updateClientStatusAction = action(updateClientStatusSchema, async ({ id, status }) => {
  const session = await getActor();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("clients")
    .update({ status })
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) throw new ActionException("INTERNAL", "상태를 변경하지 못했습니다.");
  if (!data) throw new ActionException("FORBIDDEN", "이 거래처의 상태를 변경할 권한이 없습니다.");

  await logAudit({
    workspaceId: session.workspace.id,
    actorMemberId: session.member.id,
    action: status === "ended" ? "client.ended" : "client.status_changed",
    targetTable: "clients",
    targetId: id,
    meta: { status },
  });

  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
  return { id, status };
});

// ---------------------------------------------------------------------------
// Hard delete (owner only)
// ---------------------------------------------------------------------------
export const deleteClientAction = action(deleteClientSchema, async ({ id }) => {
  const session = await getActor();
  assertOwner(session);
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("clients")
    .select("biz_name")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase.from("clients").delete().eq("id", id);
  if (error) throw new ActionException("INTERNAL", "거래처를 삭제하지 못했습니다.");

  await logAudit({
    workspaceId: session.workspace.id,
    actorMemberId: session.member.id,
    action: "client.deleted",
    targetTable: "clients",
    targetId: id,
    meta: { biz_name: existing?.biz_name ?? null },
  });

  revalidatePath("/clients");
  return { id };
});

// ---------------------------------------------------------------------------
// Assignments (owner only; multi-assignee)
// ---------------------------------------------------------------------------
export const setClientAssignmentsAction = action(
  setAssignmentsSchema,
  async ({ clientId, memberIds }) => {
    const session = await getActor();
    assertOwner(session);
    const supabase = await createClient();

    // Validate the members belong to this workspace.
    const { data: validMembers } = await supabase
      .from("members")
      .select("id")
      .in("id", memberIds.length > 0 ? memberIds : ["00000000-0000-0000-0000-000000000000"]);
    const validIds = new Set((validMembers ?? []).map((m) => m.id));
    const targetIds = memberIds.filter((mid) => validIds.has(mid));

    // Replace the assignment set: delete all, then insert the new set.
    const { error: delError } = await supabase
      .from("client_assignments")
      .delete()
      .eq("client_id", clientId);
    if (delError) throw new ActionException("INTERNAL", "담당자를 변경하지 못했습니다.");

    if (targetIds.length > 0) {
      const { error: insError } = await supabase.from("client_assignments").insert(
        targetIds.map((memberId) => ({
          workspace_id: session.workspace.id,
          client_id: clientId,
          member_id: memberId,
        })),
      );
      if (insError) throw new ActionException("INTERNAL", "담당자를 변경하지 못했습니다.");
    }

    await logAudit({
      workspaceId: session.workspace.id,
      actorMemberId: session.member.id,
      action: "client.assignments_set",
      targetTable: "clients",
      targetId: clientId,
      meta: { member_ids: targetIds },
    });

    revalidatePath(`/clients/${clientId}`);
    revalidatePath("/clients");
    return { clientId, memberIds: targetIds };
  },
);

// ---------------------------------------------------------------------------
// Bulk import (owner only; partial failure tolerated)
// ---------------------------------------------------------------------------
export type BulkImportResult = {
  inserted: number;
  failed: { row: number; biz_name: string; message: string }[];
};

export const bulkImportClientsAction = action(bulkImportSchema, async ({ rows }) => {
  const session = await getActor();
  assertOwner(session);
  const supabase = await createClient();

  const result: BulkImportResult = { inserted: 0, failed: [] };
  const seen = new Set<string>();

  for (let i = 0; i < rows.length; i += 1) {
    const values = rows[i]!;
    const row = toClientRow(values);

    // De-dupe within the uploaded file by biz_reg_no.
    if (row.biz_reg_no) {
      if (seen.has(row.biz_reg_no)) {
        result.failed.push({
          row: i + 1,
          biz_name: row.biz_name,
          message: "파일 내 사업자번호 중복",
        });
        continue;
      }
      seen.add(row.biz_reg_no);
    }

    const { error } = await supabase
      .from("clients")
      .insert({ ...row, workspace_id: session.workspace.id });

    if (error) {
      const message = error.code === "23505" ? "이미 등록된 사업자번호" : "등록 실패 (서버 오류)";
      result.failed.push({ row: i + 1, biz_name: row.biz_name, message });
    } else {
      result.inserted += 1;
    }
  }

  await logAudit({
    workspaceId: session.workspace.id,
    actorMemberId: session.member.id,
    action: "client.bulk_imported",
    targetTable: "clients",
    meta: { inserted: result.inserted, failed: result.failed.length },
  });

  revalidatePath("/clients");
  return result;
});

// ---------------------------------------------------------------------------
// Live duplicate check (for inline warnings while typing)
// ---------------------------------------------------------------------------
export async function checkBizRegNoDuplicate(input: {
  bizRegNo: string;
  excludeId?: string;
}): Promise<{ duplicate: boolean; name?: string }> {
  const session = await getSession();
  if (!session) return { duplicate: false };
  const normalized = digitsOnly(input.bizRegNo);
  if (normalized.length !== 10) return { duplicate: false };

  const supabase = await createClient();
  const dup = await findDuplicate(supabase, normalized, input.excludeId);
  return dup ? { duplicate: true, name: dup.biz_name } : { duplicate: false };
}
