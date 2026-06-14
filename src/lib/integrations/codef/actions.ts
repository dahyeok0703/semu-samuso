"use server";

import { z } from "zod";

import { action, ActionException } from "@/lib/actions/safe-action";
import { logAudit } from "@/lib/audit";
import { requireClientWrite } from "@/lib/auth/guards";
import { resolveCodef } from "@/lib/integrations/settings";

const collectSchema = z.object({
  clientId: z.string().uuid(),
  consent: z.literal(true, { errorMap: () => ({ message: "거래처 동의가 필요합니다." }) }),
  from: z
    .string()
    .regex(/^\d{8}$/)
    .optional(), // YYYYMMDD
  to: z
    .string()
    .regex(/^\d{8}$/)
    .optional(),
});

/**
 * 거래처 동의 기반 CODEF 수집 요청. 연동이 비활성(키 없음/토글 off)이면 FORBIDDEN 으로
 * 안전하게 거부한다(핵심 동작 무영향). 동의 없이는 진행하지 않는다.
 *
 * ⚠️ 실제 은행/카드 데이터 수집은 거래처별 connectedId(동의) 등록이 선행되어야 하며,
 * 수집 결과는 민감정보 비저장 원칙에 따라 비식별 요약(summarizeStatement)으로만 다룬다.
 * 본 스캐폴드는 동의·요청 접수를 감사로그로 기록한다.
 */
export const collectCodefAction = action(collectSchema, async (input) => {
  const session = await requireClientWrite(input.clientId);
  const codef = await resolveCodef(session.workspace.id);
  if (!codef.available) {
    throw new ActionException(
      "FORBIDDEN",
      "CODEF 연동이 비활성화되어 있습니다. 설정에서 키 입력 후 활성화해 주세요.",
    );
  }

  await logAudit({
    workspaceId: session.workspace.id,
    actorMemberId: session.member.id,
    action: "codef.collect_requested",
    targetTable: "clients",
    targetId: input.clientId,
    meta: { from: input.from ?? null, to: input.to ?? null },
  });

  return {
    status: "requested" as const,
    note: "수집 요청을 접수했습니다. 거래처 동의(connectedId) 등록 후 자료가 적재됩니다.",
  };
});
