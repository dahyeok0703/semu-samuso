import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Bell,
  Building2,
  CalendarDays,
  CheckCircle2,
  LayoutDashboard,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";

import { PlanCards } from "@/components/billing/plan-cards";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TRIAL_DAYS } from "@/lib/billing/plans";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: { absolute: `${siteConfig.name} — ${siteConfig.tagline}` },
  description: siteConfig.description,
  alternates: { canonical: "/" },
};

const FEATURES = [
  {
    icon: Building2,
    title: "거래처 관리",
    body: "수임 사업자를 한 곳에서. 사업자번호 검증·담당 배정·엑셀 일괄 등록까지.",
  },
  {
    icon: CalendarDays,
    title: "신고 마감 자동 생성",
    body: "과세유형·결산월로 부가세·종소세·법인세 마감을 자동 생성. 공휴일은 영업일로 보정.",
  },
  {
    icon: Sparkles,
    title: "AI 자료 분류",
    body: "수취 서류를 AI가 자동 분류. 쓸수록 정확해지는 학습 루프로 누락을 막습니다.",
  },
  {
    icon: Bell,
    title: "자동 독촉",
    body: "자료 미제출 거래처에 D-7·D-3·D-1 자동 알림. 이메일·알림톡·SMS·인앱.",
  },
  {
    icon: LayoutDashboard,
    title: "역할별 대시보드",
    body: "대표는 사무소 전체 현황을, 직원은 오늘 할 일을. 위험 거래처를 한눈에.",
  },
  {
    icon: Users,
    title: "팀 협업",
    body: "이메일로 직원을 초대하고 담당을 배정. 권한과 감사 로그로 안전하게.",
  },
] as const;

const VALUE_POINTS = [
  "자료 누락으로 인한 신고 사고 방지",
  "마감 추적을 사람 기억이 아닌 시스템으로",
  "반복 업무 자동화로 1인당 더 많은 거래처",
] as const;

export default function LandingPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_50%_0%,theme(colors.primary/8%),transparent)]"
        />
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <Badge variant="secondary" className="mb-5">
              세무사무소 전용 업무 SaaS
            </Badge>
            <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              {siteConfig.tagline}
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-pretty text-lg text-muted-foreground">
              거래처 수취 자료부터 신고 마감까지, 세무사무소의 반복 업무를 자동화합니다. AI가 자료를
              분류하고, 마감을 추적하고, 미제출 거래처를 알아서 독촉합니다.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/signup">
                  {TRIAL_DAYS}일 무료로 시작 <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/features">기능 살펴보기</Link>
              </Button>
            </div>
            <p className="mt-4 flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
              <ShieldCheck className="size-4" /> 신용카드 없이 시작 · 언제든 해지
            </p>
          </div>

          {/* Product visual placeholder */}
          <div className="mx-auto mt-14 max-w-4xl">
            <div className="rounded-xl border bg-card p-2 shadow-sm">
              <div className="rounded-lg border bg-muted/40">
                <div className="flex items-center gap-1.5 border-b px-4 py-2.5">
                  <span className="size-2.5 rounded-full bg-muted-foreground/30" />
                  <span className="size-2.5 rounded-full bg-muted-foreground/30" />
                  <span className="size-2.5 rounded-full bg-muted-foreground/30" />
                </div>
                <div className="grid gap-3 p-5 sm:grid-cols-3">
                  {[
                    { k: "이번 주 마감", v: "12건" },
                    { k: "위험 거래처", v: "3곳" },
                    { k: "자료 수취율", v: "94%" },
                  ].map((s) => (
                    <div key={s.k} className="rounded-lg border bg-background p-4 text-left">
                      <p className="text-xs text-muted-foreground">{s.k}</p>
                      <p className="mt-1 text-2xl font-bold">{s.v}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Value points */}
      <section className="border-b bg-muted/20">
        <div className="mx-auto grid max-w-6xl gap-4 px-4 py-10 sm:grid-cols-3 sm:px-6">
          {VALUE_POINTS.map((p) => (
            <div key={p} className="flex items-start gap-2.5">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" />
              <span className="text-sm font-medium">{p}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight">마감까지 한 흐름으로</h2>
          <p className="mt-3 text-muted-foreground">
            거래처 등록부터 자료 수취, 마감, 독촉까지 — 흩어진 업무를 하나로 묶습니다.
          </p>
        </div>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <Card key={f.title}>
                <CardContent className="p-6">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </span>
                  <h3 className="mt-4 font-semibold">{f.title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{f.body}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Social proof (placeholder) */}
      <section className="border-y bg-muted/20">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <p className="text-center text-sm font-medium text-muted-foreground">
            전국 세무사무소가 신뢰하는 업무 자동화
          </p>
          {/* TODO(marketing): 실제 고객사 로고/도입 사례로 교체 */}
          <div className="mt-8 grid grid-cols-2 gap-6 opacity-60 sm:grid-cols-4">
            {["사무소 A", "사무소 B", "세무법인 C", "사무소 D"].map((n) => (
              <div
                key={n}
                className="flex h-12 items-center justify-center rounded-md border bg-background text-sm text-muted-foreground"
              >
                {n}
              </div>
            ))}
          </div>
          <Card className="mx-auto mt-10 max-w-2xl">
            <CardContent className="p-6 text-center">
              {/* TODO(marketing): 실제 고객 후기로 교체 */}
              <p className="text-pretty text-lg">
                “마감 누락 걱정이 사라졌어요. 자료 독촉을 시스템이 대신 해주니 직원들이 본업에 집중할
                수 있습니다.”
              </p>
              <p className="mt-3 text-sm text-muted-foreground">— 도입 세무사무소 대표 (예시)</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Pricing summary */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight">간단한 요금제</h2>
          <p className="mt-3 text-muted-foreground">
            {TRIAL_DAYS}일 무료체험으로 먼저 써보세요. 부담 없이 시작하고 필요할 때 업그레이드하세요.
          </p>
        </div>
        <div className="mt-12">
          <PlanCards
            renderAction={(plan) => (
              <Button asChild variant={plan === "team" ? "default" : "outline"} className="w-full">
                <Link href={plan === "free" ? "/signup" : "/pricing"}>
                  {plan === "free" ? "무료로 시작" : "자세히 보기"}
                </Link>
              </Button>
            )}
          />
        </div>
        <p className="mt-6 text-center text-sm">
          <Link href="/pricing" className="font-medium text-primary hover:underline">
            전체 요금제 비교 →
          </Link>
        </p>
      </section>

      {/* Final CTA */}
      <section className="border-t bg-primary text-primary-foreground">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6">
          <h2 className="text-3xl font-bold tracking-tight">오늘부터 자료 누락 제로</h2>
          <p className="mx-auto mt-3 max-w-xl text-primary-foreground/80">
            5분이면 첫 거래처를 등록하고 올해 신고 일정을 자동으로 받아볼 수 있습니다.
          </p>
          <Button asChild size="lg" variant="secondary" className="mt-7">
            <Link href="/signup">
              {TRIAL_DAYS}일 무료로 시작 <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </section>
    </>
  );
}
