import type { Metadata } from "next";
import Link from "next/link";
import {
  Bell,
  Building2,
  CalendarDays,
  CreditCard,
  FileStack,
  LayoutDashboard,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "기능",
  description: `${siteConfig.name}의 기능 — 거래처 관리, 신고 마감 자동 생성, AI 자료 분류, 자동 독촉, 역할별 대시보드, 팀 협업.`,
  alternates: { canonical: "/features" },
};

const SECTIONS = [
  {
    icon: Building2,
    title: "거래처 관리",
    body: "수임 사업자를 한 곳에서 관리합니다. 사업자등록번호 형식·체크섬 검증과 중복 경고, 담당 직원 배정, 엑셀 일괄 등록을 지원합니다.",
    points: ["검색·필터·정렬·페이지네이션", "사업자번호 검증 + 중복 경고", "엑셀 템플릿 일괄 등록"],
  },
  {
    icon: CalendarDays,
    title: "신고 마감 자동 생성",
    body: "과세유형·결산월·플래그(반기 원천세·성실신고)로 연도별 신고 마감을 자동 생성합니다. 주말·공휴일은 다음 영업일로 보정합니다.",
    points: ["부가세·종소세·법인세·원천세", "공휴일 영업일 보정", "전사 캘린더 + 임박 강조"],
  },
  {
    icon: Sparkles,
    title: "AI 자료 분류 (RAG 학습)",
    body: "수취한 서류를 AI가 자동으로 분류하고 거래처·신고기간에 귀속시킵니다. 확정·교정 이력을 학습해 쓸수록 정확해집니다.",
    points: ["자동 분류 + 신뢰도 표시", "확정/교정 학습 루프", "워크스페이스 격리(이력 비노출)"],
  },
  {
    icon: Bell,
    title: "자동 독촉",
    body: "자료 미제출 거래처에 마감 D-7·D-3·D-1로 자동 알림을 보냅니다. 이메일·인앱이 기본, 카카오 알림톡·SMS는 토글로 켭니다.",
    points: ["규칙 엔진(D-7/3/1)", "이메일·인앱·알림톡·SMS", "발송 이력·템플릿"],
  },
  {
    icon: LayoutDashboard,
    title: "역할별 대시보드",
    body: "대표는 사무소 전체 현황(마감 카운트·위험 거래처·직원 부하)을, 직원은 오늘·이번 주 내 할 일을 봅니다.",
    points: ["대표: 위험 거래처 Top·진행률", "직원: 배정분 할 일", "모바일 카드 레이아웃"],
  },
  {
    icon: Users,
    title: "팀 협업 & 권한",
    body: "이메일로 직원을 초대하고 거래처 담당을 배정합니다. 역할 기반 권한과 감사 로그로 안전하게 운영합니다.",
    points: ["이메일 초대 → staff 합류", "거래처 일괄 재배정", "감사 로그(대표 전용)"],
  },
  {
    icon: FileStack,
    title: "비용·마진 보호",
    body: "AI 사용량을 계측해 월 문서 쿼터로 비용을 통제합니다. 문서가 폭주해도 사무소 마진이 깨지지 않도록 설계했습니다.",
    points: ["월 문서 쿼터·사용량 게이지", "쿼터 초과 시 하드캡/오버리지", "비용 절감(캐싱·배치)"],
  },
  {
    icon: CreditCard,
    title: "구독 결제",
    body: "포트원(PortOne) 정기결제로 안전하게 구독을 관리합니다. 결제수단 변경·구독 취소/재개와 청구 내역을 제공합니다.",
    points: ["빌링키 정기결제", "플랜·시트 변경", "청구 내역·영수증"],
  },
] as const;

export default function FeaturesPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">기능</h1>
        <p className="mt-3 text-muted-foreground">
          거래처 등록부터 자료 수취·마감·독촉·결제까지, 세무사무소 업무를 한 흐름으로 묶습니다.
        </p>
      </div>

      <div className="mt-14 grid gap-x-10 gap-y-12 sm:grid-cols-2">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.title} className="flex gap-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="size-5" />
              </span>
              <div>
                <h2 className="text-lg font-semibold">{s.title}</h2>
                <p className="mt-1.5 text-sm text-muted-foreground">{s.body}</p>
                <ul className="mt-3 space-y-1.5">
                  {s.points.map((p) => (
                    <li key={p} className="flex items-center gap-2 text-sm">
                      <ShieldCheck className="size-3.5 shrink-0 text-primary" /> {p}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-16 flex flex-col items-center gap-3 rounded-xl border bg-muted/20 p-10 text-center">
        <h2 className="text-2xl font-bold tracking-tight">지금 무료로 시작하세요</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          신용카드 없이 14일 동안 모든 기능을 사용해 볼 수 있습니다.
        </p>
        <div className="mt-2 flex gap-2">
          <Button asChild size="lg">
            <Link href="/signup">무료로 시작</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/pricing">요금제 보기</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
