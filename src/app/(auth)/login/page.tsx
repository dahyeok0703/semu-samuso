import type { Metadata } from "next";
import Link from "next/link";

import { LoginForm } from "@/app/(auth)/login/login-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = { title: "로그인" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string }>;
}) {
  const { redirectTo } = await searchParams;

  return (
    <Card>
      <CardHeader>
        <CardTitle>로그인</CardTitle>
        <CardDescription>이메일과 비밀번호로 로그인하세요.</CardDescription>
      </CardHeader>
      <CardContent>
        <LoginForm redirectTo={redirectTo} />
      </CardContent>
      <CardFooter className="flex flex-col gap-2 text-sm text-muted-foreground">
        <div className="flex w-full items-center justify-between">
          <Link href="/reset-password" className="hover:text-foreground hover:underline">
            비밀번호 찾기
          </Link>
          <Link href="/signup" className="hover:text-foreground hover:underline">
            회원가입
          </Link>
        </div>
      </CardFooter>
    </Card>
  );
}
