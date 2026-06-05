import type { BadgeProps } from "@/components/ui/badge";

/** Client-safe channel/status labels (no server-only imports). */
export const CHANNEL_LABELS: Record<string, string> = {
  inapp: "인앱",
  email: "이메일",
  kakao: "카카오 알림톡",
  sms: "SMS",
};

export function channelLabel(channel: string): string {
  return CHANNEL_LABELS[channel] ?? channel;
}

export const REMINDER_STATUS_LABELS: Record<string, string> = {
  queued: "대기",
  sent: "발송됨",
  failed: "실패",
};

export const REMINDER_STATUS_BADGE: Record<string, BadgeProps["variant"]> = {
  queued: "muted",
  sent: "success",
  failed: "destructive",
};
