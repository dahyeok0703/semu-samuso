import { ShieldAlert, TrendingDown } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatKrw, planLabel } from "@/lib/billing/plans";
import { TARGET_MARGIN } from "@/lib/pricing/cogs";
import { getMarginMonitor } from "@/lib/pricing/queries";

function pct(v: number | null): string {
  return v === null ? "—" : `${Math.round(v * 100)}%`;
}

/**
 * 내부(슈퍼유저) 전용 마진 모니터. 워크스페이스별 MRR vs COGS(AI+메시지+PG)로
 * 마진율을 계산해 목표(기본 50%) 미만을 자동 플래그한다. 크로스-워크스페이스
 * 집계라 service_role 가 필요하며, 호출 전 페이지에서 슈퍼유저를 검증한다.
 */
export async function MarginMonitor() {
  const monitor = await getMarginMonitor();

  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldAlert className="size-4" /> 마진 모니터 (내부 전용)
        </CardTitle>
        <CardDescription>
          {monitor.month.slice(0, 7)} · 목표 마진 {Math.round(TARGET_MARGIN * 100)}% 미만 자동
          플래그. MRR 대비 COGS(AI 분류 + 메시지 + PG 수수료) 기준.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        {!monitor.available ? (
          <p className="px-6 text-sm text-muted-foreground">
            크로스-워크스페이스 집계에는 SUPABASE_SERVICE_ROLE_KEY 가 필요합니다.
          </p>
        ) : monitor.rows.length === 0 ? (
          <p className="px-6 text-sm text-muted-foreground">집계할 워크스페이스가 없습니다.</p>
        ) : (
          <>
            {monitor.flaggedCount > 0 ? (
              <div className="mx-6 mb-3 flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <TrendingDown className="size-4" />
                목표 마진 미만 {monitor.flaggedCount}개 계정 — 쿼터/오버리지 점검 필요
              </div>
            ) : null}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>워크스페이스</TableHead>
                  <TableHead>플랜</TableHead>
                  <TableHead className="text-right">문서</TableHead>
                  <TableHead className="text-right">MRR</TableHead>
                  <TableHead className="text-right">COGS</TableHead>
                  <TableHead className="text-right">마진</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monitor.rows.map((r) => (
                  <TableRow
                    key={r.workspaceId}
                    className={r.margin.flagged ? "bg-destructive/5" : ""}
                  >
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell>
                      <span className="text-sm">{planLabel(r.effectivePlan)}</span>
                      {r.effectivePlan !== r.plan ? (
                        <span className="ml-1 text-xs text-muted-foreground">
                          ({planLabel(r.plan)})
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.docCount.toLocaleString()}
                      {r.overageDocs > 0 ? (
                        <span className="text-xs text-amber-600"> (+{r.overageDocs})</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatKrw(Math.round(r.margin.revenueKrw))}
                    </TableCell>
                    <TableCell
                      className="text-right tabular-nums"
                      title={`AI ${Math.round(r.margin.aiCostKrw)} · 메시지 ${Math.round(r.margin.messageCostKrw)} · PG ${Math.round(r.margin.pgFeeKrw)}`}
                    >
                      {formatKrw(Math.round(r.margin.cogsKrw))}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.margin.flagged ? (
                        <Badge variant="destructive">{pct(r.margin.marginRate)}</Badge>
                      ) : r.margin.marginRate === null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <Badge variant="success">{pct(r.margin.marginRate)}</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </CardContent>
    </Card>
  );
}
