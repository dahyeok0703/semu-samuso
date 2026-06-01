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
import { updatePasswordAction } from "@/lib/auth/actions";
import { updatePasswordSchema, type UpdatePasswordInput } from "@/lib/auth/schemas";

export function UpdatePasswordForm() {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<UpdatePasswordInput>({
    resolver: zodResolver(updatePasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  async function onSubmit(values: UpdatePasswordInput) {
    const result = await updatePasswordAction(values);
    if (!result.ok) {
      applyFieldErrors(result.error, setError);
      toast.error(result.error.message);
      return;
    }
    toast.success("비밀번호가 변경되었습니다.");
    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="password">새 비밀번호</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          {...register("password")}
        />
        <FieldError message={errors.password?.message} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">새 비밀번호 확인</Label>
        <Input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          {...register("confirmPassword")}
        />
        <FieldError message={errors.confirmPassword?.message} />
      </div>
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "변경 중…" : "비밀번호 변경"}
      </Button>
    </form>
  );
}
