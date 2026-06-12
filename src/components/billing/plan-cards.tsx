import { Check } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatKrw, PLAN_ORDER, PLANS } from "@/lib/billing/plans";
import type { WorkspacePlan } from "@/types/database.types";

/**
 * Pricing presentation shared by the public /pricing page and the in-app
 * billing screen. Pure/server-safe; the action buttons are injected per slot so
 * the same cards work signed-out (CTA → 회원가입) or signed-in (CTA → 구독).
 */
export function PlanCards({
  currentPlan,
  renderAction,
}: {
  currentPlan?: WorkspacePlan;
  renderAction?: (plan: WorkspacePlan) => React.ReactNode;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {PLAN_ORDER.map((id) => {
        const def = PLANS[id];
        const isCurrent = currentPlan === id;
        const highlighted = id === "team";
        return (
          <Card
            key={id}
            className={cn(
              "relative flex flex-col",
              highlighted && "border-primary shadow-sm",
              isCurrent && "ring-2 ring-primary",
            )}
          >
            {highlighted ? (
              <span className="absolute -top-2.5 left-4 rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                추천
              </span>
            ) : null}
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{def.name}</CardTitle>
                {isCurrent ? <Badge variant="success">현재 플랜</Badge> : null}
              </div>
              <p className="text-sm text-muted-foreground">{def.tagline}</p>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col">
              <div className="mb-4">
                <span className="text-2xl font-bold">{formatKrw(def.monthlyPrice)}</span>
                {def.monthlyPrice > 0 ? (
                  <span className="text-sm text-muted-foreground">
                    {def.perSeat ? " / 직원 1인 · 월" : " / 월"}
                  </span>
                ) : null}
                {def.monthlyPrice > 0 ? (
                  <p className="mt-0.5 text-xs text-muted-foreground">부가세(VAT) 별도</p>
                ) : null}
              </div>
              <ul className="mb-4 space-y-2 text-sm">
                {def.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-auto">{renderAction?.(id)}</div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
