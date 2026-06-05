import Link from "next/link";
import { AlertTriangle, CalendarDays, CalendarRange, Users } from "lucide-react";

import { FilingProgressChart, StaffLoadChart } from "@/app/(app)/dashboard/_components/charts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getOwnerDashboard } from "@/lib/dashboard/queries";

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof CalendarDays;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

export async function OwnerDashboard() {
  const d = await getOwnerDashboard();

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={CalendarDays}
          label="이번 주 마감"
          value={`${d.week.total}건`}
          hint={`완료 ${d.week.done} · 진행 ${d.week.total - d.week.done}`}
        />
        <StatCard
          icon={CalendarRange}
          label="이번 달 마감"
          value={`${d.month.total}건`}
          hint={`완료 ${d.month.done} · 진행 ${d.month.total - d.month.done}`}
        />
        <StatCard
          icon={AlertTriangle}
          label="위험 거래처"
          value={`${d.riskCount}곳`}
          hint="임박(D-7) + 자료 미제출"
        />
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="size-4" /> 직원별 부하
            </CardTitle>
          </CardHeader>
          <CardContent>
            {d.staffLoad.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                진행 중인 업무가 없습니다.
              </p>
            ) : (
              <StaffLoadChart data={d.staffLoad} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">신고유형별 진행률 (이번 달)</CardTitle>
          </CardHeader>
          <CardContent>
            {d.progress.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                이번 달 마감 예정 신고가 없습니다.
              </p>
            ) : (
              <FilingProgressChart data={d.progress} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Risk top list */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">위험 거래처 Top</CardTitle>
          <Button asChild variant="ghost" size="sm">
            <Link href="/reminders">독촉 보내기 →</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {d.riskClients.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              임박한 위험 거래처가 없습니다. 👍
            </p>
          ) : (
            <ul className="divide-y">
              {d.riskClients.map((c) => (
                <li key={c.clientId} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <Link href={`/clients/${c.clientId}`} className="font-medium hover:underline">
                      {c.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      마감 {c.taskCount}건 · 미제출 {c.missingDocs}건
                    </p>
                  </div>
                  <Badge variant={c.nearestDays <= 1 ? "destructive" : "warning"}>
                    {c.nearestDays <= 0 ? "오늘" : `D-${c.nearestDays}`}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
