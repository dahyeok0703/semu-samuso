import type { Metadata } from "next";
import Link from "next/link";

import { ResetPasswordForm } from "@/app/(auth)/reset-password/reset-password-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = { title: "비밀번호 찾기" };

export default function ResetPasswordPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>비밀번호 찾기</CardTitle>
        <CardDescription>가입한 이메일로 재설정 링크를 보내드립니다.</CardDescription>
      </CardHeader>
      <CardContent>
        <ResetPasswordForm />
      </CardContent>
      <CardFooter className="text-sm text-muted-foreground">
        <Link href="/login" className="hover:text-foreground hover:underline">
          로그인으로 돌아가기
        </Link>
      </CardFooter>
    </Card>
  );
}
