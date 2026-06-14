import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import nodemailer, { type Transporter } from "nodemailer";

import { env, features } from "@/lib/env";
import { resolveSolapi } from "@/lib/integrations/settings";
import { solapiSend } from "@/lib/integrations/solapi/client";
import type { RenderedReminder } from "@/lib/messaging/templates";
import type { Database } from "@/types/database.types";

export type Channel = "inapp" | "email" | "kakao" | "sms";

export type SendRecipient = {
  email: string | null;
  phone: string | null;
  /** Workspace staff to notify in-app (assignees, or owners if unassigned). */
  staffMemberIds: string[];
};

export type SendContext = {
  workspaceId: string;
  clientId: string;
  link: string;
};

export type SendResult = {
  status: "sent" | "failed";
  /** The channel actually used (may differ from requested, e.g. kakao→email). */
  channelUsed: Channel;
  error: string | null;
  responseNote: string | null;
};

type Supa = SupabaseClient<Database>;

const sent = (channelUsed: Channel, responseNote: string | null = null): SendResult => ({
  status: "sent",
  channelUsed,
  error: null,
  responseNote,
});
const failed = (channelUsed: Channel, error: string): SendResult => ({
  status: "failed",
  channelUsed,
  error,
  responseNote: null,
});

function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
function digits(phone: string): string {
  return phone.replace(/\D/g, "");
}

// --- email (nodemailer) -----------------------------------------------------
let transporter: Transporter | null = null;
function getTransport(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    });
  }
  return transporter;
}

async function sendEmail(r: RenderedReminder, to: string | null): Promise<SendResult> {
  if (!to) return failed("email", "수신 이메일이 없습니다.");
  if (!features.email) {
    // Graceful: no SMTP configured → log instead of breaking the flow.
    console.info(`[email:dev] → ${to} | ${r.subject}`);
    return sent("email", "개발 모드 — SMTP 미설정(발송 로그로 대체)");
  }
  try {
    await getTransport().sendMail({
      from: env.SMTP_FROM,
      to,
      subject: r.subject,
      text: r.clientBody,
    });
    return sent("email");
  } catch (e) {
    return failed("email", errMessage(e));
  }
}

// --- Solapi (kakao 알림톡 / SMS) — per-workspace config via integrations ------
async function sendKakao(
  r: RenderedReminder,
  recipient: SendRecipient,
  ctx: SendContext,
): Promise<SendResult> {
  const solapi = await resolveSolapi(ctx.workspaceId);
  // Missing keys / template / phone → fall back to email so UX isn't broken.
  if (!solapi.kakaoAvailable || !recipient.phone) {
    const fb = await sendEmail(r, recipient.email);
    return { ...fb, responseNote: "카카오 알림톡 미설정 — 이메일로 대체" };
  }
  const result = await solapiSend(solapi.config, {
    to: digits(recipient.phone),
    from: solapi.config.sender,
    type: "ATA",
    kakaoOptions: {
      pfId: solapi.config.pfId,
      templateId: solapi.config.kakaoTemplateId,
      variables: r.kakaoVariables,
      disableSms: false,
    },
  });
  return result.ok
    ? sent("kakao", result.groupId ? `solapi:${result.groupId}` : null)
    : failed("kakao", result.error ?? "발송 실패");
}

async function sendSms(
  r: RenderedReminder,
  recipient: SendRecipient,
  ctx: SendContext,
): Promise<SendResult> {
  const solapi = await resolveSolapi(ctx.workspaceId);
  if (!solapi.smsAvailable || !recipient.phone) {
    const fb = await sendEmail(r, recipient.email);
    return { ...fb, responseNote: "SMS 미설정 — 이메일로 대체" };
  }
  const result = await solapiSend(solapi.config, {
    to: digits(recipient.phone),
    from: solapi.config.sender,
    text: r.smsBody,
  });
  return result.ok
    ? sent("sms", result.groupId ? `solapi:${result.groupId}` : null)
    : failed("sms", result.error ?? "발송 실패");
}

// --- in-app (notifications insert) ------------------------------------------
async function sendInapp(
  supabase: Supa,
  r: RenderedReminder,
  recipient: SendRecipient,
  ctx: SendContext,
): Promise<SendResult> {
  if (recipient.staffMemberIds.length === 0) {
    return sent("inapp", "알림 받을 담당자가 없습니다.");
  }
  const { error } = await supabase.from("notifications").insert(
    recipient.staffMemberIds.map((member_id) => ({
      workspace_id: ctx.workspaceId,
      member_id,
      type: "reminder",
      title: r.inappTitle,
      body: r.inappBody,
      link: ctx.link,
    })),
  );
  return error ? failed("inapp", error.message) : sent("inapp");
}

/**
 * Channel abstraction entrypoint: send a rendered reminder over one channel.
 * Email is the always-available fallback; kakao/sms degrade to it when their
 * keys are not configured. `supabase` is used only by the in-app channel.
 */
export async function sendViaChannel(
  supabase: Supa,
  channel: Channel,
  rendered: RenderedReminder,
  recipient: SendRecipient,
  ctx: SendContext,
): Promise<SendResult> {
  switch (channel) {
    case "inapp":
      return sendInapp(supabase, rendered, recipient, ctx);
    case "email":
      return sendEmail(rendered, recipient.email);
    case "kakao":
      return sendKakao(rendered, recipient, ctx);
    case "sms":
      return sendSms(rendered, recipient, ctx);
    default:
      return failed(channel, "알 수 없는 채널입니다.");
  }
}

/**
 * Generic transactional email (e.g. team invites). Mirrors the reminder email
 * channel's graceful behaviour: logs instead of sending when SMTP is unset.
 */
export async function sendRawEmail(
  to: string,
  subject: string,
  text: string,
): Promise<{ ok: boolean; note: string | null; error: string | null }> {
  if (!features.email) {
    console.info(`[email:dev] → ${to} | ${subject}`);
    return { ok: true, note: "개발 모드 — SMTP 미설정(발송 로그로 대체)", error: null };
  }
  try {
    await getTransport().sendMail({ from: env.SMTP_FROM, to, subject, text });
    return { ok: true, note: null, error: null };
  } catch (e) {
    return { ok: false, note: null, error: errMessage(e) };
  }
}

/** Channels currently usable for a workspace (env ⊕ workspace settings). */
export async function availableChannels(workspaceId: string): Promise<Channel[]> {
  const list: Channel[] = ["inapp", "email"];
  const solapi = await resolveSolapi(workspaceId);
  if (solapi.kakaoAvailable) list.push("kakao");
  if (solapi.smsAvailable) list.push("sms");
  return list;
}
