"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { FieldError } from "@/components/form/field-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { applyFieldErrors } from "@/lib/actions/apply-field-errors";
import { requestPasswordResetAction } from "@/lib/auth/actions";
import { resetPasswordSchema, type ResetPasswordInput } from "@/lib/auth/schemas";

export function ResetPasswordForm() {
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: ResetPasswordInput) {
    const result = await requestPasswordResetAction(values);
    if (!result.ok) {
      applyFieldErrors(result.error, setError);
      toast.error(result.error.message);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <p className="text-sm text-muted-foreground">
        입력하신 이메일이 가입되어 있다면 비밀번호 재설정 링크를 보냈습니다. 메일함을 확인해
        주세요.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="email">이메일</Label>
        <Input id="email" type="email" autoComplete="email" {...register("email")} />
        <FieldError message={errors.email?.message} />
      </div>
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "전송 중…" : "재설정 링크 보내기"}
      </Button>
    </form>
  );
}
