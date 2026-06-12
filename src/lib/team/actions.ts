"use server";

import { randomBytes } from "node:crypto";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { action, ActionException } from "@/lib/actions/safe-action";
import { logAudit } from "@/lib/audit";
import { requireOwner } from "@/lib/auth/guards";
import { assertSeatCapacity } from "@/lib/billing/gating";
import { env } from "@/lib/env";
import { sendRawEmail } from "@/lib/messaging/channels";
import {
  acceptInviteSchema,
  bulkReassignSchema,
  inviteIdSchema,
  inviteMemberSchema,
  inviteSignupSchema,
  updateMemberRoleSchema,
  updateMemberStatusSchema,
} from "@/lib/team/schemas";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

async function getOrigin(): Promise<string> {
  if (env.NEXT_PUBLIC_SITE_URL) return env.NEXT_PUBLIC_SITE_URL;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

function newToken(): string {
  return randomBytes(24).toString("base64url");
}

async function sendInviteEmail(
  to: string,
  link: string,
  workspaceName: string,
  inviterName: string,
) {
  const subject = `[${workspaceName}] 세무사무소 업무 시스템 초대`;
  const text = [
    `${inviterName}님이 회원님을 '${workspaceName}' 사무소에 직원으로 초대했습니다.`,
    "",
    "아래 링크에서 초대를 수락하세요:",
    link,
    "",
    "이 초대는 14일 후 만료됩니다.",
  ].join("\n");
  return sendRawEmail(to, subject, text);
}

async function activeOwnerCount(supabase: SupabaseServer): Promise<number> {
  const { count } = await supabase
    .from("members")
    .select("id", { count: "exact", head: true })
    .eq("role", "owner")
    .eq("status", "active");
  return count ?? 0;
}

// ---------------------------------------------------------------------------
// Invite a staff member by email
// ---------------------------------------------------------------------------
export const inviteMemberAction = action(inviteMemberSchema, async ({ email }) => {
  const session = await requireOwner();
  await assertSeatCapacity(1); // plan seat limit (free = 1인)
  const supabase = await createClient();
  const token = newToken();

  const { error } = await supabase.from("invitations").insert({
    workspace_id: session.workspace.id,
    email,
    role: "staff",
    token,
    invited_by_member_id: session.member.id,
  });
  if (error) {
    if (error.code === "23505") {
      throw new ActionException("CONFLICT", "이미 초대한 이메일입니다.");
    }
    throw new ActionException("INTERNAL", "초대를 생성하지 못했습니다.");
  }

  const link = `${await getOrigin()}/invite/${token}`;
  const mail = await sendInviteEmail(email, link, session.workspace.name, session.member.name);

  await logAudit({
    workspaceId: session.workspace.id,
    actorMemberId: session.member.id,
    action: "member.invited",
    targetTable: "invitations",
    meta: { email, email_sent: mail.ok },
  });

  revalidatePath("/team");
  return { inviteLink: link, emailSent: mail.ok, note: mail.note };
});

// ---------------------------------------------------------------------------
// Resend / revoke invitation
// ---------------------------------------------------------------------------
export const resendInviteAction = action(inviteIdSchema, async ({ id }) => {
  const session = await requireOwner();
  const supabase = await createClient();

  const { data: inv } = await supabase
    .from("invitations")
    .select("email, token, status")
    .eq("id", id)
    .maybeSingle();
  if (!inv) throw new ActionException("NOT_FOUND", "초대를 찾을 수 없습니다.");
  if (inv.status !== "pending")
    throw new ActionException("CONFLICT", "대기 중인 초대만 재발송할 수 있습니다.");

  await supabase
    .from("invitations")
    .update({ expires_at: new Date(Date.now() + 14 * 86_400_000).toISOString() })
    .eq("id", id);

  const link = `${await getOrigin()}/invite/${inv.token}`;
  const mail = await sendInviteEmail(inv.email, link, session.workspace.name, session.member.name);

  await logAudit({
    workspaceId: session.workspace.id,
    actorMemberId: session.member.id,
    action: "member.invite_resent",
    targetTable: "invitations",
    targetId: id,
    meta: { email: inv.email },
  });

  revalidatePath("/team");
  return { inviteLink: link, emailSent: mail.ok, note: mail.note };
});

export const revokeInviteAction = action(inviteIdSchema, async ({ id }) => {
  const session = await requireOwner();
  const supabase = await createClient();

  const { error } = await supabase.from("invitations").update({ status: "revoked" }).eq("id", id);
  if (error) throw new ActionException("INTERNAL", "초대를 취소하지 못했습니다.");

  await logAudit({
    workspaceId: session.workspace.id,
    actorMemberId: session.member.id,
    action: "member.invite_revoked",
    targetTable: "invitations",
    targetId: id,
  });

  revalidatePath("/team");
  return { id };
});

// ---------------------------------------------------------------------------
// Member role / status
// ---------------------------------------------------------------------------
export const updateMemberRoleAction = action(updateMemberRoleSchema, async ({ memberId, role }) => {
  const session = await requireOwner();
  const supabase = await createClient();

  const { data: target } = await supabase
    .from("members")
    .select("role, status")
    .eq("id", memberId)
    .maybeSingle();
  if (!target) throw new ActionException("NOT_FOUND", "직원을 찾을 수 없습니다.");

  // Never leave the workspace without an active owner.
  if (target.role === "owner" && role === "staff" && (await activeOwnerCount(supabase)) <= 1) {
    throw new ActionException("CONFLICT", "최소 한 명의 대표(owner)가 필요합니다.");
  }

  const { error } = await supabase.from("members").update({ role }).eq("id", memberId);
  if (error) throw new ActionException("INTERNAL", "역할을 변경하지 못했습니다.");

  await logAudit({
    workspaceId: session.workspace.id,
    actorMemberId: session.member.id,
    action: "member.role_changed",
    targetTable: "members",
    targetId: memberId,
    meta: { role },
  });

  revalidatePath("/team");
  return { memberId, role };
});

export const updateMemberStatusAction = action(
  updateMemberStatusSchema,
  async ({ memberId, status }) => {
    const session = await requireOwner();
    const supabase = await createClient();

    const { data: target } = await supabase
      .from("members")
      .select("role, status")
      .eq("id", memberId)
      .maybeSingle();
    if (!target) throw new ActionException("NOT_FOUND", "직원을 찾을 수 없습니다.");

    if (
      target.role === "owner" &&
      status === "inactive" &&
      (await activeOwnerCount(supabase)) <= 1
    ) {
      throw new ActionException("CONFLICT", "최소 한 명의 활성 대표가 필요합니다.");
    }

    // Re-activating a member consumes a seat — enforce the plan limit.
    if (status === "active" && target.status === "inactive") {
      await assertSeatCapacity(1);
    }

    const { error } = await supabase.from("members").update({ status }).eq("id", memberId);
    if (error) throw new ActionException("INTERNAL", "상태를 변경하지 못했습니다.");

    await logAudit({
      workspaceId: session.workspace.id,
      actorMemberId: session.member.id,
      action: status === "inactive" ? "member.deactivated" : "member.activated",
      targetTable: "members",
      targetId: memberId,
      meta: { status },
    });

    revalidatePath("/team");
    return { memberId, status };
  },
);

// ---------------------------------------------------------------------------
// Bulk client reassignment
// ---------------------------------------------------------------------------
export const bulkReassignAction = action(
  bulkReassignSchema,
  async ({ clientIds, memberId, mode }) => {
    const session = await requireOwner();
    const supabase = await createClient();

    if ((mode === "add" || mode === "remove") && !memberId) {
      throw new ActionException("VALIDATION", "담당자를 선택해 주세요.");
    }
    if (memberId) {
      const { data: m } = await supabase
        .from("members")
        .select("id, status")
        .eq("id", memberId)
        .maybeSingle();
      if (!m || m.status !== "active") {
        throw new ActionException("VALIDATION", "활성 직원만 배정할 수 있습니다.");
      }
    }

    if (mode === "replace") {
      await supabase.from("client_assignments").delete().in("client_id", clientIds);
      if (memberId) {
        await supabase.from("client_assignments").insert(
          clientIds.map((client_id) => ({
            workspace_id: session.workspace.id,
            client_id,
            member_id: memberId,
          })),
        );
      }
    } else if (mode === "add" && memberId) {
      await supabase.from("client_assignments").upsert(
        clientIds.map((client_id) => ({
          workspace_id: session.workspace.id,
          client_id,
          member_id: memberId,
        })),
        { onConflict: "client_id,member_id", ignoreDuplicates: true },
      );
    } else if (mode === "remove" && memberId) {
      await supabase
        .from("client_assignments")
        .delete()
        .in("client_id", clientIds)
        .eq("member_id", memberId);
    }

    await logAudit({
      workspaceId: session.workspace.id,
      actorMemberId: session.member.id,
      action: "client.bulk_reassigned",
      meta: { count: clientIds.length, mode, member_id: memberId },
    });

    revalidatePath("/team");
    revalidatePath("/clients");
    return { count: clientIds.length, mode };
  },
);

// ---------------------------------------------------------------------------
// Accept an invitation (the invited, authenticated user — no member yet)
// ---------------------------------------------------------------------------
export const acceptInviteAction = action(acceptInviteSchema, async ({ token }) => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new ActionException("UNAUTHORIZED", "로그인이 필요합니다.");

  // RLS lets the invitee read only invites matching their JWT email.
  const { data: inv } = await supabase
    .from("invitations")
    .select("id, workspace_id, status, expires_at")
    .eq("token", token)
    .maybeSingle();
  if (!inv) throw new ActionException("NOT_FOUND", "초대를 찾을 수 없거나 권한이 없습니다.");
  if (inv.status !== "pending") throw new ActionException("CONFLICT", "이미 처리된 초대입니다.");
  if (new Date(inv.expires_at) < new Date()) {
    throw new ActionException("CONFLICT", "만료된 초대입니다. 재발송을 요청하세요.");
  }

  const name =
    (typeof user.user_metadata?.full_name === "string" && user.user_metadata.full_name) ||
    user.email?.split("@")[0] ||
    "직원";

  const { error: insErr } = await supabase.from("members").insert({
    workspace_id: inv.workspace_id,
    user_id: user.id,
    name,
    role: "staff",
    status: "active",
  });
  if (insErr) {
    if (insErr.code === "23505") {
      throw new ActionException("CONFLICT", "이미 다른 사무소에 소속되어 있습니다.");
    }
    throw new ActionException("INTERNAL", "초대 수락에 실패했습니다.");
  }

  await supabase.from("invitations").update({ status: "accepted" }).eq("id", inv.id);

  await logAudit({
    workspaceId: inv.workspace_id,
    actorMemberId: null,
    action: "member.joined",
    targetTable: "members",
    meta: { email: user.email },
  });

  return { workspaceId: inv.workspace_id };
});

// ---------------------------------------------------------------------------
// Sign up via invite (logged-out new user). Validates the token server-side
// (needs the service role to read across workspaces), then creates an auth user
// that the signup trigger will NOT give its own workspace (skip_workspace).
// ---------------------------------------------------------------------------
export const inviteSignupAction = action(
  inviteSignupSchema,
  async ({ token, fullName, password }) => {
    const admin = createAdminClient();
    if (!admin) {
      throw new ActionException(
        "FORBIDDEN",
        "현재 환경에서는 초대 가입이 비활성화되어 있습니다. 계정으로 로그인 후 수락해 주세요.",
      );
    }
    const { data: inv } = await admin
      .from("invitations")
      .select("email, status, expires_at")
      .eq("token", token)
      .maybeSingle();
    if (!inv || inv.status !== "pending" || new Date(inv.expires_at) < new Date()) {
      throw new ActionException("NOT_FOUND", "유효하지 않은 초대입니다.");
    }

    const supabase = await createClient();
    const { error } = await supabase.auth.signUp({
      email: inv.email,
      password,
      options: {
        emailRedirectTo: `${await getOrigin()}/auth/callback?next=/invite/${token}`,
        data: { full_name: fullName, skip_workspace: "true" },
      },
    });
    if (error) {
      if (error.code === "user_already_exists" || error.message.includes("already registered")) {
        throw new ActionException("CONFLICT", "이미 가입된 이메일입니다. 로그인 후 수락해 주세요.");
      }
      throw new ActionException("INTERNAL", error.message);
    }
    return { email: inv.email };
  },
);

// --- read for the accept page (not an action) -------------------------------
export type InviteForPage = {
  email: string;
  role: string;
  status: string;
  expiresAt: string;
  workspaceName: string;
};

export async function getInviteByToken(token: string): Promise<InviteForPage | null> {
  const admin = createAdminClient();
  const reader = admin ?? (await createClient());
  const { data: inv } = await reader
    .from("invitations")
    .select("email, role, status, expires_at, workspace_id")
    .eq("token", token)
    .maybeSingle();
  if (!inv) return null;

  let workspaceName = "사무소";
  const { data: ws } = await reader
    .from("workspaces")
    .select("name")
    .eq("id", inv.workspace_id)
    .maybeSingle();
  if (ws) workspaceName = ws.name;

  return {
    email: inv.email,
    role: inv.role,
    status: inv.status,
    expiresAt: inv.expires_at,
    workspaceName,
  };
}
