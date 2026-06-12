import {
  Bell,
  Building2,
  CalendarCheck,
  CalendarDays,
  CreditCard,
  FileSignature,
  FileText,
  LayoutDashboard,
  ScrollText,
  Settings,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  /** Short description shown in tooltips / mobile. */
  description?: string;
};

/** Primary navigation. Mirrors the domain vocabulary documented in CLAUDE.md. */
export const navItems: NavItem[] = [
  {
    title: "대시보드",
    href: "/dashboard",
    icon: LayoutDashboard,
    description: "사무소 현황 한눈에 보기",
  },
  {
    title: "거래처",
    href: "/clients",
    icon: Building2,
    description: "수임 거래처 관리",
  },
  {
    title: "신고",
    href: "/filings",
    icon: FileText,
    description: "부가세·종합소득세 등 신고 관리",
  },
  {
    title: "캘린더",
    href: "/calendar",
    icon: CalendarDays,
    description: "전사 신고 마감 캘린더",
  },
  {
    title: "리마인더",
    href: "/reminders",
    icon: Bell,
    description: "자료 미제출 독촉/알림",
  },
  {
    title: "마감",
    href: "/closings",
    icon: CalendarCheck,
    description: "기장 및 결산 마감",
  },
  {
    title: "수임",
    href: "/engagements",
    icon: FileSignature,
    description: "수임 계약 관리",
  },
];

export const secondaryNavItems: NavItem[] = [
  {
    title: "팀",
    href: "/team",
    icon: Users,
    description: "직원·초대·담당 배정 (대표 전용)",
  },
  {
    title: "AI 인사이트",
    href: "/admin",
    icon: Sparkles,
    description: "분류 정확도·AI 사용량 (대표 전용)",
  },
  {
    title: "감사 로그",
    href: "/audit",
    icon: ScrollText,
    description: "변경 이력 (대표 전용)",
  },
  {
    title: "구독·결제",
    href: "/billing",
    icon: CreditCard,
    description: "플랜·결제수단·청구 내역 (대표 전용)",
  },
  {
    title: "설정",
    href: "/settings",
    icon: Settings,
    description: "사무소·직원·계정 설정",
  },
];
