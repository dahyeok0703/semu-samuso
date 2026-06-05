import { z } from "zod";

export const inviteMemberSchema = z.object({
  email: z.string().trim().toLowerCase().email("올바른 이메일을 입력해 주세요."),
  // Only staff can be invited; ownership is transferred via role change.
  role: z.literal("staff").default("staff"),
});

export const inviteIdSchema = z.object({ id: z.string().uuid() });

export const updateMemberRoleSchema = z.object({
  memberId: z.string().uuid(),
  role: z.enum(["owner", "staff"]),
});

export const updateMemberStatusSchema = z.object({
  memberId: z.string().uuid(),
  status: z.enum(["active", "inactive"]),
});

export const bulkReassignSchema = z.object({
  clientIds: z.array(z.string().uuid()).min(1, "거래처를 선택해 주세요.").max(2000),
  memberId: z.string().uuid().nullable(),
  mode: z.enum(["replace", "add", "remove"]),
});

export const acceptInviteSchema = z.object({ token: z.string().min(1) });

export const inviteSignupSchema = z.object({
  token: z.string().min(1),
  fullName: z.string().trim().min(1, "이름을 입력해 주세요."),
  password: z.string().min(8, "비밀번호는 8자 이상이어야 합니다.").max(72),
});
