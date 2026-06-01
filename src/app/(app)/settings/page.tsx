import type { Metadata } from "next";

import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { requireSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "설정" };

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

export default async function SettingsPage() {
  const session = await requireSession();

  return (
    <div className="space-y-6">
      <PageHeader title="설정" description="사무소와 계정 정보를 확인합니다." />

      <Card>
        <CardHeader>
          <CardTitle>사무소</CardTitle>
          <CardDescription>현재 작업 중인 사무소(workspace) 정보입니다.</CardDescription>
        </CardHeader>
        <CardContent>
          <Row label="사무소 이름" value={session.workspace.name} />
          <Separator />
          <Row label="내 역할" value={session.member.role === "owner" ? "대표 (owner)" : "직원 (staff)"} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>계정</CardTitle>
          <CardDescription>로그인 계정 정보입니다.</CardDescription>
        </CardHeader>
        <CardContent>
          <Row label="이름" value={session.member.name} />
          <Separator />
          <Row label="이메일" value={session.email ?? "—"} />
        </CardContent>
      </Card>
    </div>
  );
}
