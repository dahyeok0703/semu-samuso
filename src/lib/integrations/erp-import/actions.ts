"use server";

import { z } from "zod";

import { action, ActionException } from "@/lib/actions/safe-action";
import { logAudit } from "@/lib/audit";
import { requireOwner } from "@/lib/auth/guards";
import { bulkImportClientsAction } from "@/lib/clients/actions";
import { erpClientsToImportRows, normalizeErpClients } from "@/lib/integrations/erp-import/parsers";
import { resolveErpImport } from "@/lib/integrations/settings";

const importSchema = z.object({
  // Rows already parsed from the uploaded file (header → value) on the client.
  rows: z.array(z.record(z.unknown())).min(1).max(5000),
});

/**
 * ERP 내보내기 파일(파싱된 행)을 거래처로 가져오기. 토글이 꺼져 있으면 FORBIDDEN.
 * 정규화 후 기존 거래처 일괄 등록(bulkImportClientsAction)을 재사용해 검증·권한·플랜
 * 한도·감사로그를 그대로 통과시킨다. 실패해도 본 시스템 영향 0.
 */
export const importErpClientsAction = action(importSchema, async ({ rows }) => {
  const session = await requireOwner();
  const { available } = await resolveErpImport(session.workspace.id);
  if (!available) {
    throw new ActionException("FORBIDDEN", "가져오기 연동이 비활성화되어 있습니다.");
  }

  const { clients, skipped } = normalizeErpClients(rows);
  if (clients.length === 0) {
    throw new ActionException(
      "VALIDATION",
      "가져올 거래처를 찾지 못했습니다. ‘상호’ 컬럼이 있는지 확인해 주세요.",
    );
  }

  const res = await bulkImportClientsAction({ rows: erpClientsToImportRows(clients) });
  if (!res.ok) throw new ActionException(res.error.code, res.error.message);

  await logAudit({
    workspaceId: session.workspace.id,
    actorMemberId: session.member.id,
    action: "erp.imported",
    targetTable: "clients",
    meta: { imported: res.data.inserted, skipped, failed: res.data.failed.length },
  });

  return { imported: res.data.inserted, skipped, failed: res.data.failed.length };
});
