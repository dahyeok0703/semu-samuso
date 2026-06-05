import "server-only";

import { createHmac, randomBytes } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";
import nodemailer, { type Transporter } from "nodemailer";

import { env, features } from "@/lib/env";
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

// --- Solapi (kakao 알림톡 / SMS) --------------------------------------------
async function solapiSend(
  message: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string }> {
  const date = new Date().toISOString();
  const salt = randomBytes(32).toString("hex");
  const signature = createHmac("sha256", env.SOLAPI_API_SECRET ?? "")
    .update(date + salt)
    .digest("hex");
  try {
    const res = await fetch("https://api.solapi.com/messages/v4/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `HMAC-SHA256 apiKey=${env.SOLAPI_API_KEY}, date=${date}, salt=${salt}, signature=${signature}`,
      },
      body: JSON.stringify({ message }),
    });
    if (!res.ok) {
      const body = await res.text();
      return { ok: false, error: `Solapi ${res.status}: ${body.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
}

async function sendKakao(r: RenderedReminder, recipient: SendRecipient): Promise<SendResult> {
  // Missing keys / template / phone → fall back to email so UX isn't broken.
  if (!features.kakao || !recipient.phone) {
    const fb = await sendEmail(r, recipient.email);
    return { ...fb, responseNote: "카카오 알림톡 미설정 — 이메일로 대체" };
  }
  const result = await solapiSend({
    to: digits(recipient.phone),
    from: env.SOLAPI_SENDER,
    type: "ATA",
    kakaoOptions: {
      pfId: env.SOLAPI_PFID,
      templateId: env.SOLAPI_KAKAO_TEMPLATE_ID,
      variables: r.kakaoVariables,
      disableSms: false,
    },
  });
  return result.ok ? sent("kakao") : failed("kakao", result.error ?? "발송 실패");
}

async function sendSms(r: RenderedReminder, recipient: SendRecipient): Promise<SendResult> {
  if (!features.solapi || !recipient.phone) {
    const fb = await sendEmail(r, recipient.email);
    return { ...fb, responseNote: "SMS 미설정 — 이메일로 대체" };
  }
  const result = await solapiSend({
    to: digits(recipient.phone),
    from: env.SOLAPI_SENDER,
    text: r.smsBody,
  });
  return result.ok ? sent("sms") : failed("sms", result.error ?? "발송 실패");
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
      return sendKakao(rendered, recipient);
    case "sms":
      return sendSms(rendered, recipient);
    default:
      return failed(channel, "알 수 없는 채널입니다.");
  }
}

/** Channels currently usable given configuration (for UI gating). */
export function availableChannels(): Channel[] {
  const list: Channel[] = ["inapp", "email"];
  if (features.kakao) list.push("kakao");
  if (features.solapi) list.push("sms");
  return list;
}
