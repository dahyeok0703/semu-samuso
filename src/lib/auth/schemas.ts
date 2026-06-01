import { z } from "zod";

const email = z.string().min(1, "이메일을 입력해 주세요.").email("올바른 이메일 형식이 아닙니다.");
const password = z
  .string()
  .min(8, "비밀번호는 8자 이상이어야 합니다.")
  .max(72, "비밀번호가 너무 깁니다.");

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "비밀번호를 입력해 주세요."),
  redirectTo: z.string().optional(),
});

export const signupSchema = z
  .object({
    email,
    password,
    confirmPassword: z.string(),
    officeName: z.string().trim().min(1, "사무소 이름을 입력해 주세요."),
    fullName: z.string().trim().min(1, "이름을 입력해 주세요."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "비밀번호가 일치하지 않습니다.",
    path: ["confirmPassword"],
  });

export const resetPasswordSchema = z.object({
  email,
});

export const updatePasswordSchema = z
  .object({
    password,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "비밀번호가 일치하지 않습니다.",
    path: ["confirmPassword"],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type UpdatePasswordInput = z.infer<typeof updatePasswordSchema>;
