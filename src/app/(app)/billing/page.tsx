import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FileText, Receipt } from "lucide-react";

import { SubscriptionPanel } from "@/app/(app)/billing/_components/subscription-panel";
import { PlanCards } from "@/components/billing/plan-cards";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { requireSession } from "@/lib/auth/session";
import { formatKrw, monthlyAmount } from "@/lib/billing/plans";
import { getBillingSummary } from "@/lib/billing/queries";
import { features } from "@/lib/env";
import type { SubscriptionStatus } from "@/types/database.types";

export const metadata: Metadata = { title: "구독·결제" };

const STATUS_LABEL: Record<SubscriptionStatus, string> = {
  none: "구독 없음",
  trialing: "무료체험",
  active: "구독 중",
  past_due: "결제 실패",
  canceled: "해지 예정",
};

const STATUS_VARIANT: Record<
  SubscriptionStatus,
  "default" | "success" | "warning" | "destructive"
> = {
  none: "default",
  trialing: "warning",
  active: "success",
  past_due: "destructive",
  canceled: "warning",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function BillingPage() {
  const session = await requireSession();
  // 결제·구독 관리는 대표(owner)만.
  if (session.member.role !== "owner") redirect("/dashboard");

  const summary = await getBillingSummary();
  const { workspace: ws, entitlements: ent, card, payments, usage } = summary;
  const billingEnabled = features.billing;

  return (
    <div className="space-y-6">
      <PageHeader
        title="구독·결제"
        description="플랜과 결제수단을 관리하고 청구 내역을 확인합니다."
      />

      {!billingEnabled ? (
        <Card className="border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
          <CardContent className="py-4 text-sm">
            <span className="font-medium">결제 기능 준비중</span> — 결제 연동(PortOne) 키가 설정되지
            않아 구독 결제는 비활성화되어 있습니다. 그 외 모든 기능은 정상적으로 사용할 수 있습니다.
          </CardContent>
        </Card>
      ) : null}

      {/* Current status */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">현재 구독</CardTitle>
            <Badge variant={STATUS_VARIANT[ws.subscription_status]}>
              {STATUS_LABEL[ws.subscription_status]}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Info
            label="플랜"
            value={`${ent.limits.name}${ws.plan === "team" ? ` · ${ws.billing_seats}석` : ""}`}
          />
          <Info
            label="월 청구액"
            value={
              ws.plan === "free"
                ? "무료"
                : `${formatKrw(monthlyAmount(ws.plan, ws.billing_seats))} (VAT 별도)`
            }
          />
          {ws.subscription_status === "trialing" ? (
            <Info
              label="체험 종료"
              value={`${fmtDate(ws.trial_ends_at)}${ent.trialDaysLeft !== null ? ` (D-${ent.trialDaysLeft})` : ""}`}
            />
          ) : (
            <Info
              label={ws.cancel_at_period_end ? "이용 종료" : "다음 결제일"}
              value={fmtDate(ws.current_period_end)}
            />
          )}
          <Info
            label="결제수단"
            value={card ? `${card.brand ?? "카드"} •••• ${card.last4 ?? "----"}` : "미등록"}
          />
        </CardContent>
      </Card>

      {/* Plans */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">플랜</h2>
        <PlanCards currentPlan={ent.effectivePlan} />
      </div>

      {/* Manage subscription (client) */}
      <SubscriptionPanel
        enabled={billingEnabled}
        config={{
          storeId: process.env.NEXT_PUBLIC_PORTONE_STORE_ID ?? "",
          channelKey: process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY ?? "",
          customerId: ws.id,
        }}
        state={{
          status: ws.subscription_status,
          plan: ws.plan,
          seats: ws.billing_seats,
          cancelAtPeriodEnd: ws.cancel_at_period_end,
          hasCard: Boolean(card),
          minSeats: usage.seats,
        }}
      />

      {/* Billing history */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Receipt className="size-4" /> 청구 내역
          </CardTitle>
          <CardDescription>최근 결제·환불 이력입니다.</CardDescription>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              아직 결제 내역이 없습니다.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">일시</th>
                    <th className="py-2 pr-3 font-medium">내역</th>
                    <th className="py-2 pr-3 font-medium">금액</th>
                    <th className="py-2 pr-3 font-medium">상태</th>
                    <th className="py-2 font-medium">영수증</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-b last:border-0">
                      <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground">
                        {fmtDate(p.paid_at ?? p.created_at)}
                      </td>
                      <td className="py-2 pr-3">{p.order_name ?? "구독 결제"}</td>
                      <td className="py-2 pr-3 whitespace-nowrap">{formatKrw(p.amount)}</td>
                      <td className="py-2 pr-3">
                        <Badge
                          variant={
                            p.status === "paid"
                              ? "success"
                              : p.status === "failed"
                                ? "destructive"
                                : "default"
                          }
                        >
                          {p.status === "paid"
                            ? "결제완료"
                            : p.status === "failed"
                              ? "실패"
                              : p.status === "canceled"
                                ? "취소"
                                : "대기"}
                        </Badge>
                      </td>
                      <td className="py-2">
                        {p.receipt_url ? (
                          <a
                            href={p.receipt_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary hover:underline"
                          >
                            보기
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tax-document guidance */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="size-4" /> 세금계산서·현금영수증
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            • 결제 영수증은 위 청구 내역의 <span className="font-medium">[영수증 보기]</span>에서
            확인할 수 있습니다(포트원 발행).
          </p>
          <p>
            • <span className="font-medium">세금계산서(매출증빙)</span> 또는{" "}
            <span className="font-medium">현금영수증(지출증빙)</span> 발급이 필요하면 사업자등록증
            사본과 함께 <span className="font-medium">billing@semu.example</span> 으로 요청해
            주세요. 영업일 기준 3일 내 발급됩니다.
          </p>
          <Separator className="my-2" />
          <p className="text-xs">
            구독료는 부가가치세(VAT) 별도 표기 금액입니다. 결제 시 VAT가 합산되어 청구됩니다.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-sm sm:block sm:space-y-0.5">
      <span className="text-muted-foreground sm:block sm:text-xs">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
