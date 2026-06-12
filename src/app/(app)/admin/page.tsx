import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Sparkles } from "lucide-react";

import { MarginMonitor } from "@/app/(app)/admin/_components/margin-monitor";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireSession } from "@/lib/auth/session";
import { features, isSuperuser } from "@/lib/env";
import { getAiUsage, getClassificationInsights } from "@/lib/insights/queries";

export const metadata: Metadata = { title: "AI 인사이트" };

function pct(v: number | null): string {
  return v === null ? "—" : `${Math.round(v * 100)}%`;
}

export default async function AdminPage() {
  const session = await requireSession();
  if (session.member.role !== "owner") redirect("/dashboard");

  const [insights, usage] = await Promise.all([getClassificationInsights(), getAiUsage()]);
  const { overall, byMonth, byClient } = insights;
  const showMarginMonitor = isSuperuser(session.email);

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI 인사이트"
        description="자동 분류와 최종 확정의 일치율(정확도) 추이와 AI 사용량입니다."
      />

      {overall.total === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="아직 학습 이력이 없습니다"
          description="서류를 분류하고 확정하면, 쓸수록 정확도가 올라가는 추이가 여기에 표시됩니다."
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  전체 분류 정확도
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{pct(overall.accuracy)}</div>
                <p className="text-xs text-muted-foreground">자동분류 = 최종확정 비율</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  확정 건수
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{overall.total}</div>
                <p className="text-xs text-muted-foreground">학습 이력에 누적된 건</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  교정 건수
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{overall.corrected}</div>
                <p className="text-xs text-muted-foreground">사람이 AI 결과를 바꾼 건</p>
              </CardContent>
            </Card>
          </div>

          {/* Monthly accuracy trend */}
          <Card>
            <CardHeader>
              <CardTitle>월별 정확도 추이</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-3 overflow-x-auto pb-2">
                {byMonth.map((b) => (
                  <div key={b.key} className="flex w-12 shrink-0 flex-col items-center gap-1">
                    <span className="text-xs font-medium tabular-nums">{pct(b.accuracy)}</span>
                    <div className="flex h-28 w-6 items-end rounded bg-muted">
                      <div
                        className="w-full rounded bg-primary transition-all"
                        style={{ height: `${Math.round((b.accuracy ?? 0) * 100)}%` }}
                      />
                    </div>
                    <span className="text-[11px] text-muted-foreground">{b.label}</span>
                    <span className="text-[10px] text-muted-foreground">n={b.total}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Per-client accuracy */}
          <Card>
            <CardHeader>
              <CardTitle>거래처별 정확도</CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>거래처</TableHead>
                    <TableHead className="text-right">건수</TableHead>
                    <TableHead className="text-right">교정</TableHead>
                    <TableHead className="text-right">정확도</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byClient.map((c) => (
                    <TableRow key={c.clientId}>
                      <TableCell className="font-medium">{c.label}</TableCell>
                      <TableCell className="text-right tabular-nums">{c.total}</TableCell>
                      <TableCell className="text-right tabular-nums">{c.corrected}</TableCell>
                      <TableCell className="text-right tabular-nums">{pct(c.accuracy)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      {/* AI usage / margin */}
      <Card>
        <CardHeader>
          <CardTitle>AI 사용량 (월별)</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {usage.length === 0 ? (
            <p className="px-6 text-sm text-muted-foreground">
              아직 AI 사용 내역이 없습니다.
              {!features.aiClassification ? " (자동 분류 비활성 — ANTHROPIC_API_KEY 미설정)" : ""}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>월</TableHead>
                  <TableHead className="text-right">처리 건</TableHead>
                  <TableHead className="text-right">입력 토큰</TableHead>
                  <TableHead className="text-right">출력 토큰</TableHead>
                  <TableHead className="text-right">추정 원가(₩)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usage.map((u) => (
                  <TableRow key={u.month}>
                    <TableCell>{u.month.slice(0, 7)}</TableCell>
                    <TableCell className="text-right tabular-nums">{u.doc_count}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {u.input_tokens.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {u.output_tokens.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {Math.round(u.est_cost_krw).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Internal margin monitor — superusers only (cross-workspace). */}
      {showMarginMonitor ? <MarginMonitor /> : null}
    </div>
  );
}
