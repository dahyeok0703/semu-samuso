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
import { signUpAction } from "@/lib/auth/actions";
import { signupSchema, type SignupInput } from "@/lib/auth/schemas";

export function SignupForm() {
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
      officeName: "",
      fullName: "",
    },
  });

  async function onSubmit(values: SignupInput) {
    const result = await signUpAction(values);
    if (!result.ok) {
      applyFieldErrors(result.error, setError);
      toast.error(result.error.message);
      return;
    }
    setSubmittedEmail(result.data.email);
    toast.success("확인 메일을 보냈습니다.");
  }

  if (submittedEmail) {
    return (
      <div className="space-y-3 text-sm">
        <p className="font-medium">메일함을 확인해 주세요.</p>
        <p className="text-muted-foreground">
          <span className="font-medium text-foreground">{submittedEmail}</span> 주소로 인증
          링크를 보냈습니다. 메일의 링크를 눌러 가입을 완료하세요.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="officeName">사무소 이름</Label>
        <Input id="officeName" placeholder="예) 가나다 세무회계" {...register("officeName")} />
        <FieldError message={errors.officeName?.message} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="fullName">이름</Label>
        <Input id="fullName" autoComplete="name" {...register("fullName")} />
        <FieldError message={errors.fullName?.message} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">이메일</Label>
        <Input id="email" type="email" autoComplete="email" {...register("email")} />
        <FieldError message={errors.email?.message} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">비밀번호</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          {...register("password")}
        />
        <FieldError message={errors.password?.message} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">비밀번호 확인</Label>
        <Input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          {...register("confirmPassword")}
        />
        <FieldError message={errors.confirmPassword?.message} />
      </div>
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "가입 중…" : "회원가입"}
      </Button>
    </form>
  );
}
