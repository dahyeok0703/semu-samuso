import Link from "next/link";
import { AlertTriangle, Clock, CreditCard } from "lucide-react";

import { cn } from "@/lib/utils";
import { resolveEntitlements, type BillingState } from "@/lib/billing/entitlements";

/**
 * Thin status banner shown to owners when billing needs attention:
 *   - 무료체험 임박 (D-3 이내)
 *   - 결제 실패(past_due) — 그레이스 기간 안내
 *   - 해지 예정(canceled)
 * Returns null when there's nothing to surface. Pure (uses resolveEntitlements).
 */
export function BillingBanner({ isOwner, state }: { isOwner: boolean; state: BillingState }) {
  if (!isOwner) return null;
  const ent = resolveEntitlements(state);

  let tone: "warn" | "danger" | null = null;
  let icon = Clock;
  let message: string | null = null;

  if (state.subscription_status === "past_due" && ent.inGrace) {
    tone = "danger";
    icon = AlertTriangle;
    message = "결제에 실패했습니다. 결제수단을 갱신하지 않으면 곧 Free로 전환됩니다.";
  } else if (state.subscription_status === "trialing" && (ent.trialDaysLeft ?? 99) <= 3) {
    tone = "warn";
    icon = Clock;
    message =
      ent.trialDaysLeft === 0
        ? "무료체험이 오늘 종료됩니다. 구독을 시작해 계속 이용하세요."
        : `무료체험이 ${ent.trialDaysLeft}일 남았습니다. 구독을 시작해 계속 이용하세요.`;
  } else if (state.subscription_status === "canceled") {
    tone = "warn";
    icon = CreditCard;
    message = "구독이 해지 예정입니다. 이용 기간 종료 후 Free로 전환됩니다.";
  }

  if (!tone || !message) return null;
  const Icon = icon;

  return (
    <Link
      href="/billing"
      className={cn(
        "flex items-center gap-2 border-b px-4 py-2 text-sm transition-colors md:px-6",
        tone === "danger"
          ? "bg-destructive/10 text-destructive hover:bg-destructive/15"
          : "bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-950 dark:text-amber-300",
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span className="min-w-0 flex-1">{message}</span>
      <span className="shrink-0 font-medium underline">구독 관리 →</span>
    </Link>
  );
}
