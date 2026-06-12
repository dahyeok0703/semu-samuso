import { FileStack } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { planLabel } from "@/lib/billing/plans";
import { getWorkspaceQuotaUsage } from "@/lib/pricing/queries";

/**
 * 이번 달 AI 문서 사용량 / 쿼터 게이지 (owner). 남은 한도와 초과 시 동작(하드캡/오버리지)을
 * 표시한다. 사용량은 ai_usage(RLS owner) 기준.
 */
export async function QuotaCard() {
  const q = await getWorkspaceQuotaUsage();
  const pct = Math.min(100, Math.round(q.ratio * 100));
  const over = q.used > q.includedDocs;
  const barColor = over ? "bg-destructive" : pct >= 80 ? "bg-amber-500" : "bg-primary";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <FileStack className="size-4" /> 이번 달 AI 문서 사용량
        </CardTitle>
        <Badge variant="muted">{planLabel(q.plan)}</Badge>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline justify-between">
          <div className="text-2xl font-bold tabular-nums">
            {q.used.toLocaleString()}
            <span className="text-base font-normal text-muted-foreground">
              {" "}
              / {q.includedDocs.toLocaleString()}건
            </span>
          </div>
          <span className="text-sm font-medium tabular-nums">{pct}%</span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full rounded-full transition-all", barColor)}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {over ? (
            q.policy === "overage" ? (
              <span className="text-amber-600 dark:text-amber-400">
                포함 한도 초과 — 초과분은 자동 과금됩니다.
              </span>
            ) : (
              <span className="text-destructive">
                포함 한도 소진 — 자동 분류가 중단되고 수동 모드로 전환됩니다.
              </span>
            )
          ) : (
            `남은 한도 ${q.remaining.toLocaleString()}건 · 초과 시 ${
              q.policy === "overage" ? "자동 과금" : "수동 전환"
            }`
          )}
        </p>
      </CardContent>
    </Card>
  );
}
