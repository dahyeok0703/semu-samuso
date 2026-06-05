"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { action, ActionException } from "@/lib/actions/safe-action";
import { logAudit } from "@/lib/audit";
import { requireOwner } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

export const officeInfoSchema = z.object({
  officeName: z.string().trim().min(1, "사무소 이름을 입력해 주세요.").max(120),
  ownerName: z.string().trim().min(1, "대표자 이름을 입력해 주세요.").max(60),
});

export const finishOnboardingSchema = z.object({ skipped: z.boolean().default(false) });

export const updateOfficeInfoAction = action(
  officeInfoSchema,
  async ({ officeName, ownerName }) => {
    const session = await requireOwner();
    const supabase = await createClient();

    const { error: wsErr } = await supabase
      .from("workspaces")
      .update({ name: officeName })
      .eq("id", session.workspace.id);
    const { error: mErr } = await supabase
      .from("members")
      .update({ name: ownerName })
      .eq("id", session.member.id);
    if (wsErr || mErr) throw new ActionException("INTERNAL", "정보를 저장하지 못했습니다.");

    revalidatePath("/onboarding");
    return { officeName, ownerName };
  },
);

export const finishOnboardingAction = action(finishOnboardingSchema, async ({ skipped }) => {
  const session = await requireOwner();
  const supabase = await createClient();

  const { error } = await supabase
    .from("workspaces")
    .update({ onboarded_at: new Date().toISOString() })
    .eq("id", session.workspace.id);
  if (error) throw new ActionException("INTERNAL", "온보딩 상태를 저장하지 못했습니다.");

  await logAudit({
    workspaceId: session.workspace.id,
    actorMemberId: session.member.id,
    action: "onboarding.completed",
    meta: { skipped },
  });

  revalidatePath("/", "layout");
  return { ok: true };
});
