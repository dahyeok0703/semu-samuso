import type { Metadata } from "next";
import Link from "next/link";

import { SignupForm } from "@/app/(auth)/signup/signup-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = { title: "회원가입" };

export default function SignupPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>회원가입</CardTitle>
        <CardDescription>
          가입하면 사무소가 자동으로 생성되고, 본인이 대표(owner)로 등록됩니다.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SignupForm />
      </CardContent>
      <CardFooter className="text-sm text-muted-foreground">
        이미 계정이 있으신가요?&nbsp;
        <Link href="/login" className="hover:text-foreground hover:underline">
          로그인
        </Link>
      </CardFooter>
    </Card>
  );
}
