import type { Metadata } from "next";
import Link from "next/link";

import { PlanCards } from "@/components/billing/plan-cards";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth/session";
import { TRIAL_DAYS } from "@/lib/billing/plans";

export const metadata: Metadata = {
  title: "요금제",
  description: "세무사무소 SaaS 요금제 — Free / Team / Pro",
};

/**
 * Public pricing page. Reachable without authentication (see middleware
 * PUBLIC_PREFIXES). Signed-in users get a link straight to the billing screen.
 */
export default async function PricingPage() {
  const session = await getSession();

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-bold tracking-tight">요금제</h1>
        <p className="mt-3 text-muted-foreground">
          {TRIAL_DAYS}일 무료체험으로 모든 기능을 먼저 사용해 보세요. 체험 종료 후에는 Free로
          전환되며 언제든 업그레이드할 수 있습니다.
        </p>
      </div>

      <PlanCards
        renderAction={(plan) => {
          if (plan === "free") {
            return (
              <Button asChild variant="outline" className="w-full">
                <Link href={session ? "/dashboard" : "/signup"}>
                  {session ? "대시보드로" : "무료로 시작"}
                </Link>
              </Button>
            );
          }
          return (
            <Button asChild className="w-full">
              <Link href={session ? "/billing" : "/signup"}>
                {session ? "구독 관리" : `${TRIAL_DAYS}일 무료로 시작`}
              </Link>
            </Button>
          );
        }}
      />

      <p className="mt-8 text-center text-xs text-muted-foreground">
        결제는 포트원(PortOne)을 통해 안전하게 처리됩니다. 세금계산서·현금영수증 발급은 결제 후
        사무소 내 결제 화면에서 안내됩니다.
      </p>
    </div>
  );
}
