"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { FieldError } from "@/components/form/field-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { applyFieldErrors } from "@/lib/actions/apply-field-errors";
import { signInAction } from "@/lib/auth/actions";
import { loginSchema, type LoginInput } from "@/lib/auth/schemas";

export function LoginForm({ redirectTo }: { redirectTo?: string }) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", redirectTo },
  });

  async function onSubmit(values: LoginInput) {
    const result = await signInAction(values);
    if (!result.ok) {
      applyFieldErrors(result.error, setError);
      toast.error(result.error.message);
      return;
    }
    toast.success("로그인되었습니다.");
    router.replace(result.data.redirectTo);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
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
          autoComplete="current-password"
          {...register("password")}
        />
        <FieldError message={errors.password?.message} />
      </div>
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "로그인 중…" : "로그인"}
      </Button>
    </form>
  );
}
