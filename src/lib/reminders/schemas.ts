import { z } from "zod";

const CHANNELS = ["inapp", "email", "kakao", "sms"] as const;

export const sendRemindersSchema = z.object({
  taskIds: z.array(z.string().uuid()).min(1, "보낼 대상을 선택해 주세요.").max(500),
  channels: z.array(z.enum(CHANNELS)).min(1, "채널을 1개 이상 선택해 주세요."),
});

export const updateReminderSettingsSchema = z.object({
  auto_send: z.boolean(),
  channels: z.array(z.enum(CHANNELS)).min(1, "채널을 1개 이상 선택해 주세요."),
  offsets: z.array(z.coerce.number().int().min(0).max(60)).min(1).max(6).optional(),
});

export const markNotificationSchema = z.object({
  id: z.string().uuid(),
});
