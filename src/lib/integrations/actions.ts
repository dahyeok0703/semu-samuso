"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { action, ActionException } from "@/lib/actions/safe-action";
import { logAudit } from "@/lib/audit";
import { requireOwner } from "@/lib/auth/guards";
import { INTEGRATIONS, type IntegrationProvider } from "@/lib/integrations/types";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database.types";

const updateSchema = z.object({
  provider: z.enum(["solapi", "codef", "erp_import"]),
  enabled: z.boolean(),
  // key→value. Empty strings mean "leave unchanged" (so secrets aren't wiped).
  config: z.record(z.string()).default({}),
});

/**
 * 연동 토글/키 저장 (owner). 키는 service-role 전용 테이블에만 기록되며, 빈 값은
 * 기존 비밀을 보존한다(덮어쓰지 않음). 감사로그에는 키 값이 아니라 변경 사실만 남긴다.
 */
export const updateIntegrationAction = action(updateSchema, async (input) => {
  const session = await requireOwner();
  const admin = createAdminClient();
  if (!admin) {
    throw new ActionException(
      "FORBIDDEN",
      "연동 설정 저장에는 SUPABASE_SERVICE_ROLE_KEY 가 필요합니다.",
    );
  }

  const provider = input.provider as IntegrationProvider;
  const allowedKeys = new Set(INTEGRATIONS[provider].keys.map((k) => k.key));

  // Merge: keep existing secrets when the field is left blank.
  const { data: existing } = await admin
    .from("integration_settings")
    .select("config")
    .eq("workspace_id", session.workspace.id)
    .eq("provider", provider)
    .maybeSingle();

  const merged: Record<string, string> = {
    ...((existing?.config as Record<string, string>) ?? {}),
  };
  for (const [k, v] of Object.entries(input.config)) {
    if (!allowedKeys.has(k)) continue; // ignore unknown keys
    if (v.trim() !== "") merged[k] = v.trim();
  }

  const { error } = await admin.from("integration_settings").upsert(
    {
      workspace_id: session.workspace.id,
      provider,
      enabled: input.enabled,
      config: merged as Json,
    },
    { onConflict: "workspace_id,provider" },
  );
  if (error) throw new ActionException("INTERNAL", "연동 설정을 저장하지 못했습니다.");

  await logAudit({
    workspaceId: session.workspace.id,
    actorMemberId: session.member.id,
    action: "integration.updated",
    targetTable: "integration_settings",
    // ★키 값은 기록하지 않는다(설정된 키 이름만).
    meta: { provider, enabled: input.enabled, keys_set: Object.keys(merged) },
  });

  revalidatePath("/settings");
  return { provider, enabled: input.enabled };
});
