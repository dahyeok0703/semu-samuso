"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  cancelSubscriptionAction,
  changePlanAction,
  resumeSubscriptionAction,
  startTrialAction,
  subscribeAction,
  updatePaymentMethodAction,
} from "@/lib/billing/actions";
import { formatKrw, monthlyAmount } from "@/lib/billing/plans";
import { issueBillingKey, type IssueConfig } from "@/lib/billing/portone-browser";
import type { SubscriptionStatus, WorkspacePlan } from "@/types/database.types";

type PaidPlan = "team" | "pro";

export function SubscriptionPanel({
  enabled,
  config,
  state,
}: {
  enabled: boolean;
  config: Omit<IssueConfig, "issueName">;
  state: {
    status: SubscriptionStatus;
    plan: WorkspacePlan;
    seats: number;
    cancelAtPeriodEnd: boolean;
    hasCard: boolean;
    minSeats: number;
  };
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [issuing, setIssuing] = useState(false);
  const [plan, setPlan] = useState<PaidPlan>(
    state.plan === "free" ? "team" : (state.plan as PaidPlan),
  );
  const [seats, setSeats] = useState(Math.max(state.seats, state.minSeats, 1));

  const busy = isPending || issuing;
  const hasActiveSub = (state.status === "active" || state.status === "canceled") && state.hasCard;
  const amount = monthlyAmount(plan, seats);

  function done(message: string) {
    toast.success(message);
    router.refresh();
  }
  function handle(res: { ok: boolean; error?: { message: string } }, okMsg: string) {
    if (!res.ok) {
      toast.error(res.error?.message ?? "요청을 처리하지 못했습니다.");
      return false;
    }
    done(okMsg);
    return true;
  }

  /** Issue a billing key via PortOne, then run `then(key)`. */
  async function withBillingKey(
    then: (k: { billingKey: string; cardBrand: string | null; cardLast4: string | null }) => void,
  ) {
    setIssuing(true);
    try {
      const issued = await issueBillingKey({
        ...config,
        issueName: "세무사무소 구독 결제수단 등록",
      });
      then(issued);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "결제수단 등록에 실패했습니다.");
    } finally {
      setIssuing(false);
    }
  }

  function onPrimary() {
    if (hasActiveSub) {
      // Card already on file → just change plan/seats.
      startTransition(async () => {
        handle(await changePlanAction({ plan, seats }), "플랜을 변경했습니다.");
      });
      return;
    }
    // New subscription → issue a card then charge the first cycle.
    void withBillingKey((key) =>
      startTransition(async () => {
        handle(
          await subscribeAction({
            plan,
            seats,
            billingKey: key.billingKey,
            cardBrand: key.cardBrand ?? undefined,
            cardLast4: key.cardLast4 ?? undefined,
          }),
          "구독을 시작했습니다.",
        );
      }),
    );
  }

  function onUpdateMethod() {
    void withBillingKey((key) =>
      startTransition(async () => {
        handle(
          await updatePaymentMethodAction({
            billingKey: key.billingKey,
            cardBrand: key.cardBrand ?? undefined,
            cardLast4: key.cardLast4 ?? undefined,
          }),
          "결제수단을 변경했습니다.",
        );
      }),
    );
  }

  if (!enabled) {
    return (
      <Card className="opacity-75">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">구독 관리</CardTitle>
        </CardHeader>
        <CardContent>
          <Button disabled className="w-full sm:w-auto">
            <CreditCard className="size-4" /> 결제 준비중
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">
            결제 연동이 구성되면 이곳에서 구독을 시작할 수 있습니다.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">구독 관리</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {state.status === "none" ? (
          <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm">
                <p className="font-medium">14일 무료체험</p>
                <p className="text-muted-foreground">결제 없이 모든 기능을 먼저 사용해 보세요.</p>
              </div>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() =>
                  startTransition(async () => {
                    handle(await startTrialAction({ plan: "pro" }), "무료체험을 시작했습니다.");
                  })
                }
              >
                <Sparkles className="size-4" /> 무료체험 시작
              </Button>
            </div>
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="plan-select">플랜</Label>
            <Select value={plan} onValueChange={(v) => setPlan(v as PaidPlan)}>
              <SelectTrigger id="plan-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="team">Team (직원 시트당 월정액)</SelectItem>
                <SelectItem value="pro">Pro (무제한 + 연동)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {plan === "team" ? (
            <div className="space-y-1.5">
              <Label htmlFor="seats">직원 시트 수</Label>
              <Input
                id="seats"
                type="number"
                min={state.minSeats}
                max={500}
                value={seats}
                onChange={(e) => setSeats(Math.max(state.minSeats, Number(e.target.value) || 1))}
              />
              <p className="text-xs text-muted-foreground">
                현재 사용 중 {state.minSeats}석 이상으로 설정할 수 있습니다.
              </p>
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-sm">
          <span className="text-muted-foreground">월 청구 예정액</span>
          <span className="font-semibold">{formatKrw(amount)} (VAT 별도)</span>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={onPrimary} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <CreditCard className="size-4" />}
            {hasActiveSub ? "플랜 변경" : "구독 시작"}
          </Button>

          {state.hasCard ? (
            <Button variant="outline" onClick={onUpdateMethod} disabled={busy}>
              결제수단 변경
            </Button>
          ) : null}

          {hasActiveSub && !state.cancelAtPeriodEnd ? (
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive"
              disabled={busy}
              onClick={() =>
                startTransition(async () => {
                  handle(
                    await cancelSubscriptionAction({}),
                    "구독을 해지했습니다. 이용 기간까지 사용할 수 있습니다.",
                  );
                })
              }
            >
              구독 취소
            </Button>
          ) : null}

          {state.cancelAtPeriodEnd || state.status === "canceled" ? (
            <Button
              variant="outline"
              disabled={busy}
              onClick={() =>
                startTransition(async () => {
                  handle(await resumeSubscriptionAction({}), "구독을 재개했습니다.");
                })
              }
            >
              구독 재개
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
