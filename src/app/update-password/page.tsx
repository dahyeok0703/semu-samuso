import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { UpdatePasswordForm } from "@/app/update-password/update-password-form";
import { Brand } from "@/components/app-shell/brand";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "비밀번호 변경" };

export default async function UpdatePasswordPage() {
  // Reaching here requires a valid session established by the reset link
  // (exchanged at /auth/callback). Otherwise send the user to login.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-muted/30 p-4">
      <div className="mb-6 flex justify-center">
        <Brand />
      </div>
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader>
            <CardTitle>비밀번호 변경</CardTitle>
            <CardDescription>새 비밀번호를 입력해 주세요.</CardDescription>
          </CardHeader>
          <CardContent>
            <UpdatePasswordForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
