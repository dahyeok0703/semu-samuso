import type { Metadata } from "next";
import { Building2, CalendarCheck, FileSignature, FileText } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "대시보드" };

const stats = [
  { label: "거래처", value: "—", icon: Building2, hint: "수임 중인 거래처" },
  { label: "이번 달 신고", value: "—", icon: FileText, hint: "진행 중인 신고" },
  { label: "마감 대기", value: "—", icon: CalendarCheck, hint: "마감 예정 건" },
  { label: "신규 수임", value: "—", icon: FileSignature, hint: "최근 30일" },
];

export default async function DashboardPage() {
  const session = await requireSession();

  return (
    <div className="space-y-6">
      <PageHeader
        title={`안녕하세요, ${session.member.display_name}님`}
        description={`${session.workspace.name} 업무 현황입니다.`}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.label}
                </CardTitle>
                <Icon className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground">{stat.hint}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>최근 활동</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            아직 표시할 활동이 없습니다. 기능 페이지가 추가되면 이곳에 요약이 표시됩니다.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
