"use client";

import { useEffect, useState } from "react";
import { Bell, Building2, CalendarDays, Sparkles, X } from "lucide-react";

import { Button } from "@/components/ui/button";

const STORAGE_KEY = "semu_tour_done_v1";

const TOUR = [
  {
    icon: Building2,
    title: "거래처를 관리하세요",
    body: "‘거래처’ 메뉴에서 수임 사업자를 등록하고, 담당 직원을 배정할 수 있어요.",
  },
  {
    icon: CalendarDays,
    title: "신고 마감을 한눈에",
    body: "‘캘린더’에서 부가세·종소세 등 모든 신고 마감을 월별로 확인합니다.",
  },
  {
    icon: Bell,
    title: "자동 독촉",
    body: "‘리마인더’에서 자료 미제출 거래처에 이메일·알림톡으로 독촉을 보냅니다.",
  },
] as const;

export function ProductTour() {
  const [step, setStep] = useState<number | null>(null);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setStep(0);
    } catch {
      // localStorage unavailable — skip the tour silently.
    }
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setStep(null);
  }

  if (step === null) return null;
  const current = TOUR[step]!;
  const Icon = current.icon;
  const last = step === TOUR.length - 1;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[320px] rounded-xl border bg-popover p-4 shadow-lg">
      <div className="mb-2 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Icon className="size-4" />
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
            <Sparkles className="size-3" /> 둘러보기 {step + 1}/{TOUR.length}
          </span>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="둘러보기 닫기"
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>
      <h3 className="text-sm font-semibold">{current.title}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{current.body}</p>
      <div className="mt-3 flex items-center justify-between">
        <button
          type="button"
          onClick={dismiss}
          className="text-xs text-muted-foreground hover:underline"
        >
          건너뛰기
        </button>
        <Button size="sm" onClick={() => (last ? dismiss() : setStep(step + 1))}>
          {last ? "시작하기" : "다음"}
        </Button>
      </div>
    </div>
  );
}
